/**
 * Mirrors backend `calculate_dashboard_stats` efficiency logic (status-weighted + anomaly dampening).
 * If the API still returns 0 (stale image) but we have sensor rows, recompute from the list.
 */
export function computeEfficiencyScore(stats, sensors) {
  const raw = stats?.efficiency_score ?? stats?.efficiencyScore ?? stats?.system_efficiency;
  const explicit = Number(raw);
  const list = Array.isArray(sensors) ? sensors : [];
  const n = list.length;

  if (n === 0) {
    return Number.isFinite(explicit) ? explicit : 0;
  }

  let normal = 0;
  let warning = 0;
  let critical = 0;
  let anomaly = 0;
  for (const s of list) {
    if (s.status === 'critical') critical += 1;
    else if (s.status === 'warning') warning += 1;
    else normal += 1;
    if (s.is_anomaly === true) anomaly += 1;
  }

  const statusWeighted = (normal * 100 + warning * 68 + critical * 28) / n;
  const anomalyRatio = anomaly / n;
  const damp = 1 - 0.45 * Math.min(1, anomalyRatio ** 0.85);
  const computed = Math.max(0, Math.min(100, Math.round(statusWeighted * damp * 10) / 10));

  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  return computed;
}
