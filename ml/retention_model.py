"""Nutrient retention model for Cookwise.

Two layers:

1. **Analytic** — USDA-style base retention factors per cooking method
   (``data/retention_factors.csv``) combined with first-order thermal
   degradation for the heat-labile vitamins::

       R = base * exp(-k_ref * Q10 ** ((T - 100) / 10) * minutes)

   with ``k_ref`` in min^-1 at a reference temperature of 100 degC. Minerals,
   protein, fat and fibre are treated as heat-insensitive: their loss is the
   method's base factor (leaching, drip loss, charring) with a small extra
   penalty above 200 degC.

2. **Learned** — a ``GradientBoostingRegressor`` per nutrient, fitted on a
   synthetic sample drawn from layer 1 plus noise, so the service can be
   swapped for a model trained on real measurements later without changing the
   API. ``estimate()`` uses the fitted models when ``models/*.joblib`` exist
   and silently falls back to the analytic formula when they do not.

Usage::

    python retention_model.py train      # fit and save the models
    python retention_model.py demo       # print a couple of estimates
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "retention_factors.csv"
MODEL_DIR = BASE_DIR / "models"

NUTRIENTS: List[str] = [
    "vitaminC",
    "vitaminB6",
    "folate",
    "vitaminA",
    "protein",
    "fat",
    "iron",
    "calcium",
    "fiber",
]

METHODS: List[str] = [
    "raw",
    "boil",
    "steam",
    "saute",
    "stir_fry",
    "shallow_fry",
    "deep_fry",
    "bake",
    "roast",
    "grill",
    "pressure_cook",
    "simmer",
    "microwave",
]

#: Weighted mean used for the single "overall" score (matches the TS engine).
NUTRIENT_WEIGHTS: Dict[str, float] = {
    "vitaminC": 0.25,
    "folate": 0.15,
    "vitaminB6": 0.15,
    "vitaminA": 0.10,
    "protein": 0.20,
    "fat": 0.05,
    "iron": 0.05,
    "calcium": 0.025,
    "fiber": 0.025,
}

#: First-order rate constants at 100 degC (min^-1) and their Q10 factors.
KINETICS: Dict[str, Dict[str, float]] = {
    "vitaminC": {"k_ref": 0.010, "q10": 2.0},
    "folate": {"k_ref": 0.007, "q10": 2.0},
    "vitaminB6": {"k_ref": 0.004, "q10": 2.0},
    "vitaminA": {"k_ref": 0.003, "q10": 1.5},
}

T_REF_C = 100.0
#: Above this pan temperature, surface charring costs a little of everything.
CHAR_THRESHOLD_C = 200.0

#: Pan temperature is not food temperature. Moist food stays near the boiling
#: point while the pan runs far hotter, so only a fraction of the excess heat
#: reaches the bulk of the food. Without this correction the Q10 term explodes
#: (a 190 degC stir-fry gives k = 0.01 * 2**9 = 5.12/min, i.e. every heat-labile
#: vitamin is pinned at the 0.02 floor after one minute, which is wrong and
#: makes the model carry no signal). These two constants map pan temperature to
#: an effective food temperature; the separate charring term above still
#: captures real surface damage at high heat.
HEAT_TRANSFER_FRACTION = 0.25
MAX_FOOD_TEMP_C = 140.0


def effective_food_temp_c(pan_temp_c: float) -> float:
    """Bulk food temperature implied by a pan temperature."""
    pan = float(pan_temp_c)
    if pan <= T_REF_C:
        return pan
    return min(MAX_FOOD_TEMP_C, T_REF_C + (pan - T_REF_C) * HEAT_TRANSFER_FRACTION)

#: Plausible (avg_temp_c, minutes) envelopes per method, used for sampling.
METHOD_ENVELOPE: Dict[str, Dict[str, Sequence[float]]] = {
    "raw": {"temp": (18, 35), "minutes": (0, 5)},
    "boil": {"temp": (92, 102), "minutes": (2, 45)},
    "steam": {"temp": (95, 108), "minutes": (3, 30)},
    "saute": {"temp": (120, 185), "minutes": (2, 25)},
    "stir_fry": {"temp": (160, 220), "minutes": (2, 15)},
    "shallow_fry": {"temp": (150, 195), "minutes": (3, 20)},
    "deep_fry": {"temp": (165, 200), "minutes": (1, 12)},
    "bake": {"temp": (150, 220), "minutes": (10, 60)},
    "roast": {"temp": (160, 235), "minutes": (15, 90)},
    "grill": {"temp": (180, 265), "minutes": (3, 30)},
    "pressure_cook": {"temp": (108, 122), "minutes": (3, 40)},
    "simmer": {"temp": (82, 98), "minutes": (5, 60)},
    "microwave": {"temp": (88, 112), "minutes": (1, 15)},
}

_factors_cache: pd.DataFrame | None = None
_models_cache: Dict[str, object] | None = None


# ---------------------------------------------------------------------------
# Base factors
# ---------------------------------------------------------------------------


def load_factors() -> pd.DataFrame:
    """USDA-style base retention factors, indexed by cooking method."""
    global _factors_cache
    if _factors_cache is None:
        df = pd.read_csv(DATA_PATH)
        _factors_cache = df.set_index("cooking_method")
    return _factors_cache


def base_retention(method: str, nutrient: str) -> float:
    factors = load_factors()
    key = method if method in factors.index else "saute"
    return float(factors.loc[key, nutrient])


def factors_as_dict() -> Dict[str, Dict[str, float]]:
    """The whole table as ``{method: {nutrient: factor}}`` (for the API)."""
    return {
        str(method): {n: float(row[n]) for n in NUTRIENTS}
        for method, row in load_factors().iterrows()
    }


# ---------------------------------------------------------------------------
# Analytic model
# ---------------------------------------------------------------------------


def analytic_retention(
    method: str,
    avg_temp_c: float,
    minutes: float,
    max_temp_c: float | None = None,
    nutrients: Iterable[str] | None = None,
) -> Dict[str, float]:
    """Base factor x first-order thermal decay, clipped to [0.02, 1.0]."""
    wanted = list(nutrients) if nutrients else NUTRIENTS
    peak = float(max_temp_c if max_temp_c is not None else avg_temp_c)
    minutes = max(0.0, float(minutes))

    out: Dict[str, float] = {}
    for nutrient in wanted:
        base = base_retention(method, nutrient)

        if nutrient in KINETICS and minutes > 0:
            k_ref = KINETICS[nutrient]["k_ref"]
            q10 = KINETICS[nutrient]["q10"]
            food_temp = effective_food_temp_c(avg_temp_c)
            k = k_ref * (q10 ** ((food_temp - T_REF_C) / 10.0))
            value = base * float(np.exp(-k * minutes))
        else:
            value = base

        # Charring above 200 degC costs a little of every nutrient.
        if peak > CHAR_THRESHOLD_C:
            value *= 1.0 - min(0.15, (peak - CHAR_THRESHOLD_C) / 600.0)

        out[nutrient] = float(np.clip(value, 0.02, 1.0))

    return out


def overall_score(retained: Dict[str, float]) -> float:
    """Weighted mean over the nutrients present in ``retained``."""
    total_weight = sum(NUTRIENT_WEIGHTS[n] for n in retained if n in NUTRIENT_WEIGHTS)
    if total_weight <= 0:
        return 0.0
    acc = sum(
        NUTRIENT_WEIGHTS[n] * value for n, value in retained.items() if n in NUTRIENT_WEIGHTS
    )
    return float(np.clip(acc / total_weight, 0.0, 1.0))


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------


def featurize(method: str, avg_temp_c: float, minutes: float, max_temp_c: float) -> np.ndarray:
    """``[method one-hot (13), avg_temp_c, minutes, max_temp_c]``."""
    one_hot = np.zeros(len(METHODS), dtype=float)
    idx = METHODS.index(method) if method in METHODS else METHODS.index("saute")
    one_hot[idx] = 1.0
    return np.concatenate([one_hot, [float(avg_temp_c), float(minutes), float(max_temp_c)]])


def feature_names() -> List[str]:
    return [f"method_{m}" for m in METHODS] + ["avg_temp_c", "minutes", "max_temp_c"]


# ---------------------------------------------------------------------------
# Synthetic training set
# ---------------------------------------------------------------------------


def build_dataset(samples_per_method: int = 400, seed: int = 7) -> pd.DataFrame:
    """Sample plausible cooking conditions and label them with the analytic model."""
    rng = np.random.default_rng(seed)
    rows: List[Dict[str, float | str]] = []

    for method in METHODS:
        env = METHOD_ENVELOPE[method]
        t_lo, t_hi = env["temp"]
        m_lo, m_hi = env["minutes"]

        for _ in range(samples_per_method):
            avg_temp = float(rng.uniform(t_lo, t_hi))
            minutes = float(rng.uniform(m_lo, m_hi))
            # A peak a few degrees above the average, occasionally a hot spot.
            max_temp = avg_temp + float(abs(rng.normal(8.0, 12.0)))

            truth = analytic_retention(method, avg_temp, minutes, max_temp)
            row: Dict[str, float | str] = {
                "cooking_method": method,
                "avg_temp_c": avg_temp,
                "minutes": minutes,
                "max_temp_c": max_temp,
            }
            for nutrient, value in truth.items():
                # Measurement noise: real retention studies scatter a few points.
                noisy = value + float(rng.normal(0.0, 0.02))
                row[nutrient] = float(np.clip(noisy, 0.02, 1.0))
            rows.append(row)

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Training / loading
# ---------------------------------------------------------------------------


def train(samples_per_method: int = 400, seed: int = 7) -> Dict[str, float]:
    """Fit one GradientBoostingRegressor per nutrient and save to ``models/``.

    Returns the held-out mean absolute error per nutrient.
    """
    from joblib import dump
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.metrics import mean_absolute_error
    from sklearn.model_selection import train_test_split

    df = build_dataset(samples_per_method=samples_per_method, seed=seed)
    X = np.vstack(
        [
            featurize(r.cooking_method, r.avg_temp_c, r.minutes, r.max_temp_c)
            for r in df.itertuples()
        ]
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    scores: Dict[str, float] = {}

    for nutrient in NUTRIENTS:
        y = df[nutrient].to_numpy()
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=seed
        )
        model = GradientBoostingRegressor(
            n_estimators=250,
            learning_rate=0.06,
            max_depth=3,
            subsample=0.9,
            random_state=seed,
        )
        model.fit(X_train, y_train)
        scores[nutrient] = float(mean_absolute_error(y_test, model.predict(X_test)))
        dump(model, MODEL_DIR / f"{nutrient}.joblib")

    global _models_cache
    _models_cache = None  # force a reload on the next estimate()
    return scores


def load_models() -> Dict[str, object]:
    """Loaded regressors, or an empty dict when nothing has been trained."""
    global _models_cache
    if _models_cache is not None:
        return _models_cache

    models: Dict[str, object] = {}
    if MODEL_DIR.is_dir():
        try:
            from joblib import load

            for nutrient in NUTRIENTS:
                path = MODEL_DIR / f"{nutrient}.joblib"
                if path.is_file():
                    models[nutrient] = load(path)
        except Exception:  # noqa: BLE001 - never let a bad artefact break the API
            models = {}

    _models_cache = models
    return models


def models_available() -> bool:
    return len(load_models()) == len(NUTRIENTS)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def estimate(
    method: str,
    avg_temp_c: float,
    minutes: float,
    max_temp_c: float | None = None,
    nutrients: Iterable[str] | None = None,
) -> Dict[str, float]:
    """Fraction of each nutrient retained after one cooking step.

    Uses the trained models when they exist, otherwise the analytic formula.
    """
    wanted = [n for n in (nutrients or NUTRIENTS) if n in NUTRIENTS]
    if not wanted:
        wanted = list(NUTRIENTS)

    peak = float(max_temp_c if max_temp_c is not None else avg_temp_c)
    models = load_models()

    if len(models) < len(NUTRIENTS):
        return analytic_retention(method, avg_temp_c, minutes, peak, wanted)

    features = featurize(method, avg_temp_c, minutes, peak).reshape(1, -1)
    out: Dict[str, float] = {}
    for nutrient in wanted:
        model = models[nutrient]
        value = float(model.predict(features)[0])  # type: ignore[attr-defined]
        out[nutrient] = float(np.clip(value, 0.02, 1.0))
    return out


def estimate_steps(
    steps: Sequence[Dict[str, float | str]],
    nutrients: Iterable[str] | None = None,
) -> Dict[str, object]:
    """Multiply the per-step retentions together and add the overall score."""
    wanted = [n for n in (nutrients or NUTRIENTS) if n in NUTRIENTS] or list(NUTRIENTS)
    product = {n: 1.0 for n in wanted}

    for step in steps:
        per_step = estimate(
            str(step.get("method", "saute")),
            float(step.get("avg_temp_c", 100.0)),
            float(step.get("minutes", 0.0)),
            float(step["max_temp_c"]) if step.get("max_temp_c") is not None else None,
            wanted,
        )
        for nutrient, value in per_step.items():
            product[nutrient] *= value

    clipped = {n: float(np.clip(v, 0.0, 1.0)) for n, v in product.items()}
    return {
        "nutrients": clipped,
        "overall": overall_score(clipped),
        "model": "gradient_boosting" if models_available() else "analytic",
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _main(argv: Sequence[str]) -> int:
    command = argv[1] if len(argv) > 1 else "train"

    if command == "train":
        print("Training retention models...")
        scores = train()
        for nutrient, mae in scores.items():
            print(f"  {nutrient:<10} holdout MAE {mae:.4f}")
        print(f"Saved {len(scores)} models to {MODEL_DIR}")
        return 0

    if command == "demo":
        for method, temp, minutes in (
            ("boil", 100, 12),
            ("stir_fry", 190, 6),
            ("steam", 100, 8),
        ):
            result = estimate(method, temp, minutes, temp + 10)
            pretty = ", ".join(f"{k}={v:.2f}" for k, v in result.items())
            print(f"{method:<10} {temp}C {minutes}min -> {pretty}")
        return 0

    print(f"Unknown command: {command}. Use 'train' or 'demo'.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
