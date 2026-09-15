"""Dependency-free smoke test for the retention model.

`tests/test_retention.py` is the real suite, but it needs pytest. This script
covers the same invariants with nothing but the runtime dependencies:

    python selfcheck.py

Exits 0 when every check passes, 1 otherwise.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import retention_model as rm  # noqa: E402

failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name}{(' - ' + detail) if detail and not condition else ''}")
    if not condition:
        failures.append(name)


def main() -> int:
    factors = rm.factors_as_dict()
    check("factor table covers every method", set(factors) == set(rm.METHODS))
    check(
        "factor table covers every nutrient",
        all(set(row) == set(rm.NUTRIENTS) for row in factors.values()),
    )
    check(
        "weights sum to 1.0",
        abs(sum(rm.NUTRIENT_WEIGHTS.values()) - 1.0) < 1e-9,
        f"got {sum(rm.NUTRIENT_WEIGHTS.values())}",
    )

    raw = rm.analytic_retention("raw", 22, 0)
    check("raw retains everything", all(abs(v - 1.0) < 1e-9 for v in raw.values()))

    short = rm.analytic_retention("boil", 100, 5)["vitaminC"]
    long = rm.analytic_retention("boil", 100, 30)["vitaminC"]
    check("longer boiling loses more vitamin C", long < short, f"{long:.3f} vs {short:.3f}")

    cool = rm.analytic_retention("saute", 120, 10)["vitaminC"]
    hot = rm.analytic_retention("saute", 180, 10)["vitaminC"]
    check("hotter sauteing loses more vitamin C", hot < cool, f"{hot:.3f} vs {cool:.3f}")

    steamed = rm.analytic_retention("steam", 100, 10)
    boiled = rm.analytic_retention("boil", 100, 10)
    check("steaming beats boiling for vitamin C", steamed["vitaminC"] > boiled["vitaminC"])
    check("steaming beats boiling for folate", steamed["folate"] > boiled["folate"])

    quick = rm.analytic_retention("boil", 100, 2)["calcium"]
    slow = rm.analytic_retention("boil", 100, 40)["calcium"]
    check("calcium is heat-insensitive", abs(quick - slow) < 1e-9)

    in_range = True
    for method in rm.METHODS:
        for value in rm.analytic_retention(method, 260, 240, 300).values():
            in_range = in_range and 0.02 <= value <= 1.0
    check("values stay within [0.02, 1.0]", in_range)

    two = rm.estimate_steps(
        [
            {"method": "saute", "avg_temp_c": 160, "minutes": 5, "max_temp_c": 175},
            {"method": "simmer", "avg_temp_c": 95, "minutes": 15, "max_temp_c": 100},
        ]
    )
    one = rm.estimate_steps(
        [{"method": "saute", "avg_temp_c": 160, "minutes": 5, "max_temp_c": 175}]
    )
    check("steps multiply", two["nutrients"]["vitaminC"] < one["nutrients"]["vitaminC"])
    check("overall score is in range", 0.0 <= two["overall"] <= 1.0)

    subset = rm.estimate_steps(
        [{"method": "boil", "avg_temp_c": 100, "minutes": 10}],
        nutrients=["vitaminC", "protein"],
    )
    check("nutrient subset respected", set(subset["nutrients"]) == {"vitaminC", "protein"})

    features = rm.featurize("boil", 100, 10, 105)
    check("feature vector length", len(features) == len(rm.METHODS) + 3)

    learned = rm.estimate("boil", 100, 12, 104)
    analytic = rm.analytic_retention("boil", 100, 12, 104)
    close = all(abs(learned[n] - analytic[n]) < 0.12 for n in rm.NUTRIENTS)
    check(
        f"estimate() tracks the analytic curve (model: {two['model']})",
        close,
    )

    print()
    if failures:
        print(f"{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
