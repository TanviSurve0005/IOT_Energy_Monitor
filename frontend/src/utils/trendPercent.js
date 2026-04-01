/**
 * Percent change from first to last point in a time series (same units).
 * Avoids comparing unrelated aggregates (e.g. lifetime total vs per-interval average).
 */
export function seriesEndpointPercentChange(rows, getValue) {
  if (!rows?.length || rows.length < 2) return 0;
  const first = Number(getValue(rows[0]));
  const last = Number(getValue(rows[rows.length - 1]));
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
  const base = Math.abs(first);
  if (base < 1e-9) return 0;
  return ((last - first) / base) * 100;
}

/**
 * Integer display for trend badges (floor of magnitude), capped for sanity.
 */
export function formatTrendPercentDisplay(change, maxAbs = 999) {
  const n = Number(change);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.floor(Math.abs(n)), maxAbs);
}
