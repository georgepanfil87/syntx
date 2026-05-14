export const formatPercent = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

export const formatMs = (ms: number): string => {
  if (ms === 0 || !Number.isFinite(ms)) return '—';
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const formatTime = (ts: number): string => {
  const ms = ts < 1e12 ? ts * 1000 : ts;
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const statusVariant = (
  status: number,
): 'success' | 'warning' | 'destructive' | 'outline' => {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'destructive';
  return 'outline';
};
