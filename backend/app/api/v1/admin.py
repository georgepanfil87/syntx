"""Admin / introspection endpoints — `/api/v1/admin`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.metrics import MetricsRecorder, get_metrics_recorder
from app.db.models.user import User
from app.schemas.metrics import AggregateOut, MetricsResponse, SampleOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/metrics",
    response_model=MetricsResponse,
    summary="Snapshot of the in-memory AI metrics buffer",
    responses={401: {"description": "Missing or invalid bearer token."}},
)
async def get_metrics(
    limit: int = Query(
        default=200,
        ge=1,
        le=1024,
        description="Cap on raw samples returned (most-recent-last).",
    ),
    _current_user: User = Depends(get_current_user),
    recorder: MetricsRecorder = Depends(get_metrics_recorder),
) -> MetricsResponse:
    """Return roll-ups + a tail of raw samples.

    The dashboard renders the aggregates as headline numbers and
    the raw samples as a table / sparkline. Capping `limit` keeps
    payloads bounded — even at 1024 samples this is well under
    100 KB on the wire.
    """
    samples = recorder.snapshot()
    overall_agg = recorder.aggregate()
    per = recorder.per_endpoint()
    return MetricsResponse(
        capacity=recorder.capacity,
        overall=AggregateOut(
            count=overall_agg.count,
            success_rate=overall_agg.success_rate,
            p50_ms=overall_agg.p50_ms,
            p95_ms=overall_agg.p95_ms,
            avg_ms=overall_agg.avg_ms,
        ),
        by_endpoint={
            endpoint: AggregateOut(
                count=agg.count,
                success_rate=agg.success_rate,
                p50_ms=agg.p50_ms,
                p95_ms=agg.p95_ms,
                avg_ms=agg.avg_ms,
            )
            for endpoint, agg in per.items()
        },
        samples=[
            SampleOut(
                timestamp=s.timestamp,
                endpoint=s.endpoint,
                model=s.model,
                status=s.status,
                latency_ms=s.latency_ms,
                completion_chars=s.completion_chars,
            )
            for s in samples[-limit:]
        ],
    )
