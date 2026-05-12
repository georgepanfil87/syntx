export interface SampleOut {
  timestamp: number;
  endpoint: string;
  model: string | null;
  status: number;
  latency_ms: number;
  completion_chars: number | null;
}

export interface AggregateOut {
  count: number;
  success_rate: number;
  p50_ms: number;
  p95_ms: number;
  avg_ms: number;
}

export interface MetricsResponse {
  capacity: number;
  overall: AggregateOut;
  by_endpoint: Record<string, AggregateOut>;
  samples: SampleOut[];
}
