// Freshness penalty: a skill that hasn't been re-observed in months is
// less reliable than one re-extracted yesterday. Decay halves the
// effective confidence roughly every 6 months: confidence * 0.95^(days/30)
// at 30 days = 0.95×, at 180 days = ~0.74×, at 365 days = ~0.54×.
//
// We never mutate the stored confidence — the raw value preserves how
// strong the signal was when it was extracted. Decay is applied at read
// time so we can change the curve without rebuilding everything.

export const STALE_THRESHOLD = 0.45;

export function effectiveConfidence(
  rawConfidence: number,
  lastObservedAt: string | null,
): number {
  if (!lastObservedAt) return rawConfidence;
  const then = new Date(lastObservedAt).getTime();
  if (Number.isNaN(then)) return rawConfidence;
  const daysSince = Math.max(0, (Date.now() - then) / (24 * 60 * 60 * 1000));
  const factor = Math.pow(0.95, daysSince / 30);
  return Math.max(0, Math.min(1, rawConfidence * factor));
}

export function isStale(skill: { confidence: number; last_observed_at: string | null }): boolean {
  return effectiveConfidence(skill.confidence, skill.last_observed_at) < STALE_THRESHOLD;
}

// "very stale" = candidate for auto-supersede in a future cleanup job.
export function isVeryStale(skill: { confidence: number; last_observed_at: string | null }): boolean {
  return effectiveConfidence(skill.confidence, skill.last_observed_at) < 0.25;
}
