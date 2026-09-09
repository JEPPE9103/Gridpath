export type SlopeConstraintMode = "hard" | "preference";

export function isSlopeConstraintMode(value: string): value is SlopeConstraintMode {
  return value === "hard" || value === "preference";
}

/** Percent slope (rise/run × 100) to degrees. 8% ≈ 4.57°. */
export function slopeDegreesFromPercent(percent: number): number {
  return (Math.atan(percent / 100) * 180) / Math.PI;
}

export function resolveMaxSlopeDegrees(input: {
  maxSlopeDegrees?: number | null;
  maxSlopePercent?: number | null;
}): number | null {
  if (input.maxSlopeDegrees != null && Number.isFinite(input.maxSlopeDegrees)) {
    return input.maxSlopeDegrees;
  }
  if (input.maxSlopePercent != null && Number.isFinite(input.maxSlopePercent)) {
    return slopeDegreesFromPercent(input.maxSlopePercent);
  }
  return null;
}

export type TerrainMetrics = {
  queried: boolean;
  meanSlopeDeg: number | null;
  medianSlopeDeg: number | null;
  p90SlopeDeg: number | null;
  maxSlopeDeg: number | null;
  pctBelowThreshold: number | null;
  sourceName: string | null;
};

export function classifySlopeAgainstThreshold(input: {
  mode: SlopeConstraintMode;
  thresholdDeg: number;
  metrics: TerrainMetrics;
  preferenceMinPctBelow?: number;
}): {
  hardFail: boolean;
  favorable: boolean;
  explanation: string;
} {
  const { mode, thresholdDeg, metrics } = input;
  const minPct = input.preferenceMinPctBelow ?? 80;
  if (!metrics.queried) {
    return {
      hardFail: false,
      favorable: false,
      explanation:
        "A slope threshold is configured, but a supported terrain dataset is not available for this search. The constraint was not applied.",
    };
  }
  const pct = metrics.pctBelowThreshold;
  const p90 = metrics.p90SlopeDeg;
  const mean = metrics.meanSlopeDeg;
  const parts = [
    pct != null ? `${pct.toFixed(1)}% of assessed area ≤ ${thresholdDeg}°` : null,
    p90 != null ? `P90 slope ${p90.toFixed(1)}°` : null,
    mean != null ? `mean slope ${mean.toFixed(1)}°` : null,
  ].filter(Boolean);

  if (mode === "hard") {
    const exceeds =
      (pct != null && pct < 50) ||
      (pct == null && p90 != null && p90 > thresholdDeg) ||
      (pct == null && p90 == null && mean != null && mean > thresholdDeg);
    if (exceeds) {
      return {
        hardFail: true,
        favorable: false,
        explanation: `Terrain exceeds the configured ${thresholdDeg}° hard threshold. ${parts.join("; ")}. This is not a constructability finding.`,
      };
    }
    return {
      hardFail: false,
      favorable: pct != null ? pct >= minPct : mean != null && mean <= thresholdDeg,
      explanation: `Favorable terrain against configured screening criterion (${thresholdDeg}° hard exclusion). ${parts.join("; ")}.`,
    };
  }

  const favorable = pct != null ? pct >= minPct : mean != null && mean <= thresholdDeg;
  return {
    hardFail: false,
    favorable,
    explanation: favorable
      ? `Favorable terrain against configured screening criterion (prefer ≥${minPct}% ≤ ${thresholdDeg}°). ${parts.join("; ")}.`
      : `Terrain is weaker against the configured preference (≥${minPct}% ≤ ${thresholdDeg}°). ${parts.join("; ")}.`,
  };
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const clamped = Math.min(1, Math.max(0, p));
  const index = (sorted.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function summariseSlopeSample(values: number[], thresholdDeg: number) {
  const finite = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (finite.length === 0) {
    return {
      meanSlopeDeg: null,
      medianSlopeDeg: null,
      p90SlopeDeg: null,
      maxSlopeDeg: null,
      pctBelowThreshold: null,
    };
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const below = finite.filter((value) => value <= thresholdDeg).length;
  return {
    meanSlopeDeg: mean,
    medianSlopeDeg: percentile(finite, 0.5),
    p90SlopeDeg: percentile(finite, 0.9),
    maxSlopeDeg: finite[finite.length - 1],
    pctBelowThreshold: (below / finite.length) * 100,
  };
}

/** Horn slope in degrees from a 3×3 elevation window. dzx/dzy are rise over run. */
export function hornSlopeDegrees(dzdx: number, dzdy: number): number {
  return (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
}
