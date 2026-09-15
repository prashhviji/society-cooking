"""Cookwise nutrient-retention service (optional).

The TypeScript engine in ``src/lib/engines/retention.ts`` is the offline
fallback and always runs; this service only exists so the gradient-boosting
model in ``retention_model.py`` can refine the estimate when it is reachable.

Run it with::

    uvicorn main:app --reload --port 8000

and point the Next.js app at it with ``ML_SERVICE_URL=http://localhost:8000``.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import retention_model as rm

app = FastAPI(
    title="Cookwise Retention Service",
    version="1.0.0",
    description="Estimates the fraction of each nutrient surviving a cooking session.",
)

# Development-friendly CORS. The Next.js app normally proxies through
# /api/ml/retention (same origin), so this mainly helps local experiments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class Step(BaseModel):
    method: str = Field(default="saute", description="CookingMethod from types.ts")
    avg_temp_c: float = Field(default=100.0, ge=-20, le=500)
    minutes: float = Field(default=0.0, ge=0, le=600)
    max_temp_c: Optional[float] = Field(default=None, ge=-20, le=600)


class EstimateRequest(BaseModel):
    steps: List[Step] = Field(min_length=1, max_length=40)
    nutrients: Optional[List[str]] = None


class EstimateResponse(BaseModel):
    nutrients: Dict[str, float]
    overall: float
    model: str
    steps: int


class HealthResponse(BaseModel):
    status: str
    models_trained: bool
    nutrients: List[str]
    methods: List[str]
    version: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        models_trained=rm.models_available(),
        nutrients=rm.NUTRIENTS,
        methods=rm.METHODS,
        version=app.version,
    )


@app.get("/retention/factors")
def retention_factors() -> Dict[str, object]:
    """The USDA-style base factor table plus the kinetic constants."""
    return {
        "factors": rm.factors_as_dict(),
        "kinetics": rm.KINETICS,
        "weights": rm.NUTRIENT_WEIGHTS,
        "reference_temp_c": rm.T_REF_C,
    }


@app.post("/retention/estimate", response_model=EstimateResponse)
def retention_estimate(request: EstimateRequest) -> EstimateResponse:
    """Per-nutrient retention across every step (product), plus one score."""
    steps = [step.model_dump() for step in request.steps]
    result = rm.estimate_steps(steps, request.nutrients)
    return EstimateResponse(
        nutrients=result["nutrients"],  # type: ignore[arg-type]
        overall=float(result["overall"]),  # type: ignore[arg-type]
        model=str(result["model"]),
        steps=len(steps),
    )
