# Cookwise — nutrient retention service (optional)

A small FastAPI service that estimates how much of each nutrient survives a
cooking session. It is **entirely optional**: `src/lib/engines/retention.ts` is
the always-available offline implementation, and the Next.js route
`/api/ml/retention` replies `503 { fallback: true }` whenever this service is
not configured or not reachable.

```
ml/
  main.py                    FastAPI app (3 routes)
  retention_model.py         factors + kinetics + gradient boosting
  data/retention_factors.csv USDA-style base retention per method x nutrient
  models/                    *.joblib written by `retention_model.py train` (gitignored)
  tests/test_retention.py    pytest suite
  selfcheck.py               same assertions without pytest
```

---

## Setup

Python 3.11.

```bash
cd ml
python -m venv .venv
```

Activate it:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# Git Bash on Windows
source .venv/Scripts/activate

# macOS / Linux
source .venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
python retention_model.py train        # fits 9 models into models/
uvicorn main:app --reload --port 8000
```

Without activating the venv, prefix the interpreter instead:

```bash
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
./.venv/Scripts/python.exe retention_model.py train
./.venv/Scripts/python.exe -m uvicorn main:app --reload --port 8000
```

Dev extras (not in `requirements.txt` because the service does not need them):

```bash
pip install pytest httpx pillow
# pytest + httpx -> tests/test_retention.py and its FastAPI TestClient checks
# pillow         -> scripts/gen-icons.py, which regenerates the PWA icons
```

Point the app at it in `.env.local`:

```
ML_SERVICE_URL=http://localhost:8000
```

Training is optional — without `models/` the service answers from the analytic
formula and `"model"` in the response reads `analytic` instead of
`gradient_boosting`.

---

## API

### `GET /health`

```json
{
  "status": "ok",
  "models_trained": true,
  "nutrients": ["vitaminC", "vitaminB6", "folate", "vitaminA", "protein", "fat", "iron", "calcium", "fiber"],
  "methods": ["raw", "boil", "steam", "saute", "stir_fry", "shallow_fry", "deep_fry", "bake", "roast", "grill", "pressure_cook", "simmer", "microwave"],
  "version": "1.0.0"
}
```

### `GET /retention/factors`

The base factor table, the kinetic constants and the scoring weights — useful
for keeping the TypeScript engine in sync.

### `POST /retention/estimate`

```bash
curl -X POST http://localhost:8000/retention/estimate \
  -H "content-type: application/json" \
  -d '{"steps":[{"method":"saute","avg_temp_c":165,"minutes":6,"max_temp_c":180},
                {"method":"simmer","avg_temp_c":95,"minutes":12,"max_temp_c":100}]}'
```

```json
{
  "nutrients": { "vitaminC": 0.299, "vitaminB6": 0.468, "folate": 0.358, "vitaminA": 0.717,
                 "protein": 0.855, "fat": 0.859, "iron": 0.772, "calcium": 0.807, "fiber": 0.939 },
  "overall": 0.567,
  "model": "gradient_boosting",
  "steps": 2
}
```

`nutrients` is the **product** of the per-step retentions; `overall` is the
weighted mean (vitamin C 0.25, folate 0.15, B6 0.15, A 0.10, protein 0.20,
fat 0.05, iron 0.05, calcium 0.025, fiber 0.025). Pass `"nutrients": [...]` to
restrict the response to a subset.

---

## The model

**Layer 1 — analytic.** `data/retention_factors.csv` holds a base retention
factor for every (cooking method, nutrient) pair, approximating the *USDA Table
of Nutrient Retention Factors, Release 6*. Heat-labile vitamins then decay with
first-order kinetics:

```
R = base * exp(-k * minutes)
k = k_ref * Q10 ** ((T_food - 100) / 10)
```

| nutrient  | k_ref (min⁻¹ at 100 °C) | Q10 |
|---|---|---|
| vitamin C | 0.010 | 2.0 |
| folate    | 0.007 | 2.0 |
| vitamin B6| 0.004 | 2.0 |
| vitamin A | 0.003 | 1.5 |

Protein, fat, fibre and the minerals are heat-insensitive — their loss is the
method's base factor (leaching into cooking water, drip loss, charring).
Above 200 °C peak an extra charring penalty (up to 15 %) applies to everything.

> **Pan temperature is not food temperature.** Moist food stays near boiling
> while the pan runs far hotter, so only ~25 % of the excess above 100 °C is
> carried into the kinetics, capped at 140 °C (`effective_food_temp_c`).
> Without that correction a 190 °C stir-fry gives `k = 0.01·2⁹ = 5.12 min⁻¹`
> and every heat-labile vitamin pins to the floor after one minute.

**Layer 2 — learned.** `python retention_model.py train` samples ~400 plausible
(temperature, duration) pairs per method from `METHOD_ENVELOPE`, labels them
with layer 1 plus σ = 0.02 measurement noise, and fits one
`GradientBoostingRegressor` per nutrient on
`[method one-hot (13), avg_temp_c, minutes, max_temp_c]`. Holdout MAE lands
around 0.013–0.019. `estimate()` uses the regressors when `models/*.joblib`
exist and falls back to layer 1 otherwise, so the service always answers.

Swapping in a model trained on real measurements means replacing
`build_dataset()` and re-running `train` — nothing else changes.

---

## Tests

```bash
python -m pytest             # 16 tests, including the FastAPI routes
python selfcheck.py          # same invariants, no pytest needed
python retention_model.py demo
```

The suite asserts the physics, not just the plumbing: longer and hotter cooking
must lose more vitamin C, steaming must beat boiling for water-soluble
vitamins, minerals must be time-independent, every value must stay in
[0.02, 1.0], and multi-step sessions must retain less than single-step ones.
