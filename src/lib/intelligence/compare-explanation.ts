import {
  calculateDevelopmentProfile,
  type DevelopmentProfileFactor,
  type DevelopmentProfileInput,
} from "@/lib/domain/development-profile";

export type CompareExplanationOptions = {
  isHighestInComparison?: boolean;
  comparisonSize?: number;
};

function dominantFactors(factors: DevelopmentProfileFactor[]): DevelopmentProfileFactor[] {
  const nonZero = factors.filter((factor) => factor.points !== 0);
  return [...nonZero].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 3);
}

function phraseForFactor(factor: DevelopmentProfileFactor): string {
  switch (factor.key) {
    case "outlook":
      return factor.label.toLowerCase();
    case "confidence":
      return factor.label.toLowerCase();
    case "readiness":
      return factor.label.toLowerCase();
    case "stage":
      return `${factor.label.replace(" — process validation", "").replace(" stage", "")} connection stage`;
    case "connection_case":
      return factor.label.toLowerCase();
    case "critical_alerts":
    case "warning_alerts":
      return factor.label.toLowerCase();
    default:
      return factor.label.toLowerCase();
  }
}

function capitalizeFirst(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildDevelopmentProfileExplanation(
  input: DevelopmentProfileInput,
  options: CompareExplanationOptions = {},
): string {
  const profile = calculateDevelopmentProfile(input);
  const factors = dominantFactors(profile.factors);
  const negative = factors.filter((factor) => factor.points < 0);
  const positive = factors.filter((factor) => factor.points > 0);

  let body: string;

  if (factors.length === 0) {
    body = "Limited workflow signals are recorded for this project.";
  } else if (negative.length > 0 && positive.length > 0) {
    const lead = `${capitalizeFirst(phraseForFactor(positive[0]))}, but ${phraseForFactor(negative[0])}`;
    const extra = factors
      .slice(2)
      .map(phraseForFactor)
      .filter(Boolean);
    body = extra.length > 0 ? `${lead}, with ${extra.join(" and ")}.` : `${lead}.`;
  } else if (negative.length > 0) {
    const lead = factors.map(phraseForFactor).join(", ");
    body = `${capitalizeFirst(lead)}.`;
  } else {
    const lead = factors.map(phraseForFactor).join(", ");
    body = `${capitalizeFirst(lead)}.`;
  }

  if (options.isHighestInComparison && (options.comparisonSize ?? 0) >= 2) {
    const normalized = body.endsWith(".") ? body.slice(0, -1) : body;
    return `Strongest current development profile in this comparison: ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}.`;
  }

  return body.endsWith(".") ? body : `${body}.`;
}
