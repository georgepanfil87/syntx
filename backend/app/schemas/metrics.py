"""Wire schemas for `GET /api/v1/admin/metrics`.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SampleOut(BaseModel):
    model_config = ConfigDict(frozen=True)

    timestamp: float
    endpoint: str
    model: str | None
    status: int
    latency_ms: float
    completion_chars: int | None


class AggregateOut(BaseModel):
    model_config = ConfigDict(frozen=True)

    count: int
    success_rate: float = Field(ge=0.0, le=1.0)
    p50_ms: float
    p95_ms: float
    avg_ms: float


class MetricsResponse(BaseModel):
    """Snapshot of the in-memory metrics buffer."""

    model_config = ConfigDict(frozen=True)

    capacity: int = Field(description="Maximum number of samples retained.")
    overall: AggregateOut = Field(description="Roll-up across every endpoint.")
    by_endpoint: dict[str, AggregateOut] = Field(
        description="Roll-up per endpoint kind (e.g. `ai.complete`).",
    )
    samples: list[SampleOut] = Field(
        description="Most-recent-last list of raw samples (capped by `limit`).",
    )
