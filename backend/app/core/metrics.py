"""In-memory ring buffer for AI endpoint telemetry.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from typing import Literal

EndpointKind = Literal[
    "ai.complete",
    "ai.chat",
    "ai.project_chat",
    "ai.models",
]

_BUFFER_CAPACITY = 1024


@dataclass(frozen=True, slots=True)
class Sample:
    """One observed request.
    """

    timestamp: float  # Unix seconds; sortable, JSON-friendly.
    endpoint: EndpointKind
    model: str | None
    status: int
    latency_ms: float
    completion_chars: int | None  # None for endpoints without output text


@dataclass(frozen=True, slots=True)
class Aggregate:
    """Roll-up over a slice of the buffer.
    """

    count: int
    success_rate: float  # in [0, 1]; 0 when count == 0
    p50_ms: float
    p95_ms: float
    avg_ms: float


class MetricsRecorder:
    """Process-global ring buffer + aggregation."""

    def __init__(self, capacity: int = _BUFFER_CAPACITY) -> None:
        self._samples: deque[Sample] = deque(maxlen=capacity)
        self._capacity = capacity

    @property
    def capacity(self) -> int:
        return self._capacity

    def record(
        self,
        *,
        endpoint: EndpointKind,
        model: str | None,
        status: int,
        latency_ms: float,
        completion_chars: int | None = None,
    ) -> None:
        self._samples.append(
            Sample(
                timestamp=time.time(),
                endpoint=endpoint,
                model=model,
                status=status,
                latency_ms=latency_ms,
                completion_chars=completion_chars,
            )
        )

    def snapshot(self) -> list[Sample]:
        """Return a list copy so callers can iterate safely."""
        return list(self._samples)

    def aggregate(self, *, endpoint: EndpointKind | None = None) -> Aggregate:
        """Roll-up over all samples (optionally filtered by endpoint)."""
        samples = self._samples if endpoint is None else [
            s for s in self._samples if s.endpoint == endpoint
        ]
        return _aggregate(samples)

    def per_endpoint(self) -> dict[EndpointKind, Aggregate]:
        """One aggregate per endpoint kind (skipping kinds with no samples)."""
        groups: dict[EndpointKind, list[Sample]] = {}
        for s in self._samples:
            groups.setdefault(s.endpoint, []).append(s)
        return {k: _aggregate(v) for k, v in groups.items()}


def _aggregate(samples: list[Sample] | deque[Sample]) -> Aggregate:
    if not samples:
        return Aggregate(count=0, success_rate=0.0, p50_ms=0.0, p95_ms=0.0, avg_ms=0.0)
    latencies = sorted(s.latency_ms for s in samples)
    successes = sum(1 for s in samples if 200 <= s.status < 300)
    n = len(samples)
    return Aggregate(
        count=n,
        success_rate=successes / n,
        p50_ms=_percentile(latencies, 50),
        p95_ms=_percentile(latencies, 95),
        avg_ms=sum(latencies) / n,
    )


def _percentile(sorted_values: list[float], pct: int) -> float:
    """Nearest-rank percentile.

    For `pct=50` over `[1, 2, 3, 4]` returns the 2nd value (`2`),
    matching the textbook definition. Empty inputs are handled by
    the caller; we assume a non-empty list here.
    """
    if not sorted_values:
        return 0.0
    rank = max(1, int(round(pct / 100.0 * len(sorted_values))))
    return sorted_values[rank - 1]


# Process-global. FastAPI exposes this via a dependency
# (`get_metrics_recorder`) so tests can monkey-patch it cleanly.
_RECORDER = MetricsRecorder()


def get_metrics_recorder() -> MetricsRecorder:
    return _RECORDER


class TimedRecord:
    """Async context manager that records latency on exit.
    """

    __slots__ = ("_recorder", "_endpoint", "_model", "status", "completion_chars", "_start")

    def __init__(
        self,
        recorder: MetricsRecorder,
        *,
        endpoint: EndpointKind,
        model: str | None,
    ) -> None:
        self._recorder = recorder
        self._endpoint = endpoint
        self._model = model
        self.status: int = 500
        self.completion_chars: int | None = None
        self._start: float = 0.0

    async def __aenter__(self) -> TimedRecord:
        self._start = time.perf_counter()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        latency_ms = (time.perf_counter() - self._start) * 1000.0
        self._recorder.record(
            endpoint=self._endpoint,
            model=self._model,
            status=self.status,
            latency_ms=latency_ms,
            completion_chars=self.completion_chars,
        )
        # Never swallow — let the exception propagate.
        return None
