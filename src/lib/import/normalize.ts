import {
  PROJECT_CONFIDENCE_VALUES,
  PROJECT_OUTLOOK_VALUES,
  PROJECT_STAGE_VALUES,
  PROJECT_TECHNOLOGY_VALUES,
  confidenceToDb,
  outlookToDb,
  pipelineStageToDb,
  technologyToDb,
} from "@/lib/domain/catalog-labels";

const TECHNOLOGY_ALIASES: Record<string, (typeof PROJECT_TECHNOLOGY_VALUES)[number]> = {
  bess: "battery_storage",
  battery: "battery_storage",
  batteries: "battery_storage",
  "battery storage": "battery_storage",
  "battery energy storage": "battery_storage",
  "energy storage": "battery_storage",
  batteri: "battery_storage",
  batterilagring: "battery_storage",
  pv: "solar",
  photovoltaic: "solar",
  sol: "solar",
  solcell: "solar",
  solceller: "solar",
  vind: "wind",
  ev: "ev_infrastructure",
  charging: "ev_infrastructure",
  "ev charging": "ev_infrastructure",
  "ev charger": "ev_infrastructure",
  "ev infrastructure": "ev_infrastructure",
  industri: "industrial",
  industry: "industrial",
};

const STAGE_ALIASES: Record<string, (typeof PROJECT_STAGE_VALUES)[number]> = {
  inquiry: "enquiry",
  "grid study": "grid_study",
  "feasibility study": "grid_study",
  energization: "energisation",
  construction: "construction",
};

const OUTLOOK_ALIASES: Record<string, (typeof PROJECT_OUTLOOK_VALUES)[number]> = {
  favorable: "favourable",
  "at risk": "at_risk",
  "needs attention": "at_risk",
};

function key(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function normalizeImportTechnology(
  value: string | null | undefined,
): (typeof PROJECT_TECHNOLOGY_VALUES)[number] | null {
  if (!value?.trim()) {
    return null;
  }
  const fromCatalog = technologyToDb(value);
  if (fromCatalog) {
    return fromCatalog;
  }
  return TECHNOLOGY_ALIASES[key(value)] ?? null;
}

export function normalizeImportStage(
  value: string | null | undefined,
): (typeof PROJECT_STAGE_VALUES)[number] | null {
  if (!value?.trim()) {
    return null;
  }
  const fromCatalog = pipelineStageToDb(value);
  if (fromCatalog) {
    return fromCatalog;
  }
  return STAGE_ALIASES[key(value)] ?? null;
}

export function normalizeImportOutlook(
  value: string | null | undefined,
): (typeof PROJECT_OUTLOOK_VALUES)[number] | null {
  if (!value?.trim()) {
    return null;
  }
  const fromCatalog = outlookToDb(value);
  if (fromCatalog) {
    return fromCatalog;
  }
  return OUTLOOK_ALIASES[key(value)] ?? null;
}

export function normalizeImportConfidence(
  value: string | null | undefined,
): (typeof PROJECT_CONFIDENCE_VALUES)[number] | null {
  if (!value?.trim()) {
    return null;
  }
  const fromCatalog = confidenceToDb(value);
  if (fromCatalog) {
    return fromCatalog;
  }
  const numeric = Number(value.replace("%", "").trim());
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) {
    if (numeric >= 75) return "high";
    if (numeric >= 40) return "medium";
    if (numeric > 0) return "low";
    return "unknown";
  }
  return null;
}

export function parseImportNumber(value: string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalised = trimmed.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseImportMw(value: string | null | undefined): number | null {
  if (value == null || !value.trim()) {
    return null;
  }
  const stripped = value.trim().replace(/mw$/i, "").trim();
  return parseImportNumber(stripped);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR = /^\d{4}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;
const QUARTER = /^q[1-4]\s+\d{4}$/i;

export function normalizeImportTargetCod(value: string | null | undefined): {
  value: string | null;
  error: string | null;
} {
  if (value == null || !value.trim()) {
    return { value: null, error: null };
  }
  const trimmed = value.trim();
  if (YEAR.test(trimmed) || YEAR_MONTH.test(trimmed) || QUARTER.test(trimmed)) {
    return { value: trimmed, error: null };
  }
  const iso = trimmed.match(ISO_DATE);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== Number(iso[1]) ||
      date.getUTCMonth() + 1 !== Number(iso[2]) ||
      date.getUTCDate() !== Number(iso[3])
    ) {
      return { value: null, error: "Target COD is not a valid date." };
    }
    return { value: trimmed, error: null };
  }
  if (trimmed.length > 40) {
    return { value: null, error: "Target COD is too long." };
  }
  return { value: trimmed, error: null };
}
