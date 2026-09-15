"""Tests for the retention model and the FastAPI service.

Run from the `ml/` directory:

    .venv/Scripts/python -m pytest          # Windows
    .venv/bin/python -m pytest              # macOS / Linux

`ml/selfcheck.py` runs the same assertions without pytest.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import retention_model as rm  # noqa: E402


# ---------------------------------------------------------------------------
# Factor table
# ---------------------------------------------------------------------------


def test_factor_table_covers_every_method_and_nutrient() -> None:
    factors = rm.factors_as_dict()
    assert set(factors) == set(rm.METHODS)
    for method, row in factors.items():
        assert set(row) == set(rm.NUTRIENTS), method
        for nutrient, value in row.items():
            assert 0.0 < value <= 1.0, f"{method}/{nutrient} = {value}"


def test_raw_retains_everything() -> None:
    retained = rm.analytic_retention("raw", 22, 0)
    assert all(abs(v - 1.0) < 1e-9 for v in retained.values())


def test_weights_sum_to_one() -> None:
    assert abs(sum(rm.NUTRIENT_WEIGHTS.values()) - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# Analytic kinetics
# ---------------------------------------------------------------------------


def test_longer_cooking_destroys_more_vitamin_c() -> None:
    short = rm.analytic_retention("boil", 100, 5)["vitaminC"]
    long = rm.analytic_retention("boil", 100, 30)["vitaminC"]
    assert long < short


def test_hotter_cooking_destroys_more_vitamin_c() -> None:
    cool = rm.analytic_retention("saute", 120, 10)["vitaminC"]
    hot = rm.analytic_retention("saute", 180, 10)["vitaminC"]
    assert hot < cool


def test_steaming_beats_boiling_for_water_soluble_vitamins() -> None:
    steamed = rm.analytic_retention("steam", 100, 10)
    boiled = rm.analytic_retention("boil", 100, 10)
    assert steamed["vitaminC"] > boiled["vitaminC"]
    assert steamed["folate"] > boiled["folate"]


def test_minerals_are_heat_insensitive() -> None:
    quick = rm.analytic_retention("boil", 100, 2)["calcium"]
    slow = rm.analytic_retention("boil", 100, 40)["calcium"]
    assert quick == pytest.approx(slow)


def test_values_stay_in_range() -> None:
    for method in rm.METHODS:
        retained = rm.analytic_retention(method, 260, 240, 300)
        for nutrient, value in retained.items():
            assert 0.02 <= value <= 1.0, f"{method}/{nutrient} = {value}"


def test_unknown_method_falls_back_to_saute() -> None:
    assert rm.analytic_retention("sous_vide", 100, 10) == rm.analytic_retention(
        "saute", 100, 10
    )


# ---------------------------------------------------------------------------
# Multi-step aggregation
# ---------------------------------------------------------------------------


def test_steps_multiply() -> None:
    result = rm.estimate_steps(
        [
            {"method": "saute", "avg_temp_c": 160, "minutes": 5, "max_temp_c": 175},
            {"method": "simmer", "avg_temp_c": 95, "minutes": 15, "max_temp_c": 100},
        ]
    )
    assert set(result["nutrients"]) == set(rm.NUTRIENTS)
    assert 0.0 <= result["overall"] <= 1.0
    # Two cooking steps must retain less than either one alone.
    one_step = rm.estimate_steps(
        [{"method": "saute", "avg_temp_c": 160, "minutes": 5, "max_temp_c": 175}]
    )
    assert result["nutrients"]["vitaminC"] < one_step["nutrients"]["vitaminC"]


def test_nutrient_subset_is_respected() -> None:
    result = rm.estimate_steps(
        [{"method": "boil", "avg_temp_c": 100, "minutes": 10}],
        nutrients=["vitaminC", "protein"],
    )
    assert set(result["nutrients"]) == {"vitaminC", "protein"}


def test_overall_score_is_weighted() -> None:
    perfect = rm.overall_score({n: 1.0 for n in rm.NUTRIENTS})
    assert perfect == pytest.approx(1.0)
    half = rm.overall_score({n: 0.5 for n in rm.NUTRIENTS})
    assert half == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# Learned model
# ---------------------------------------------------------------------------


def test_dataset_shape() -> None:
    df = rm.build_dataset(samples_per_method=5, seed=1)
    assert len(df) == 5 * len(rm.METHODS)
    for nutrient in rm.NUTRIENTS:
        assert nutrient in df.columns


def test_featurize_length() -> None:
    features = rm.featurize("boil", 100, 10, 105)
    assert len(features) == len(rm.METHODS) + 3
    assert len(rm.feature_names()) == len(features)


def test_estimate_matches_analytic_when_untrained_or_close_when_trained() -> None:
    learned = rm.estimate("boil", 100, 12, 104)
    analytic = rm.analytic_retention("boil", 100, 12, 104)
    for nutrient in rm.NUTRIENTS:
        # Untrained: identical. Trained: the regressor fits the same curve
        # within its noise budget.
        assert abs(learned[nutrient] - analytic[nutrient]) < 0.12, nutrient


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


def test_api_endpoints() -> None:
    fastapi_testclient = pytest.importorskip("fastapi.testclient")
    import main  # noqa: PLC0415

    client = fastapi_testclient.TestClient(main.app)

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    factors = client.get("/retention/factors")
    assert factors.status_code == 200
    assert "factors" in factors.json()

    estimate = client.post(
        "/retention/estimate",
        json={
            "steps": [
                {"method": "saute", "avg_temp_c": 165, "minutes": 6, "max_temp_c": 180}
            ]
        },
    )
    assert estimate.status_code == 200
    body = estimate.json()
    assert 0.0 <= body["overall"] <= 1.0
    assert body["steps"] == 1

    bad = client.post("/retention/estimate", json={"steps": []})
    assert bad.status_code == 422
