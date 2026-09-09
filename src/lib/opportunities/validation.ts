import {
  isOpportunityTechnology,
  OPPORTUNITY_TECHNOLOGY_VALUES,
  type OpportunityTechnologyValue,
} from "@/lib/opportunities/catalog";

export type OpportunityFormInput = {
  name: string;
  technology: string;
  country: string;
  region: string;
  municipality: string;
  latitude: string;
  longitude: string;
  targetMw: string;
  targetMwh: string;
  siteAreaHa: string;
  minSiteAreaHa: string;
  maxDistanceKm: string;
  excludeProtected: string;
  excludeNatura: string;
  maxSlopePercent: string;
  minDistanceResidentialM: string;
  notes: string;
};

export type OpportunityFormFieldErrors = Partial<Record<keyof OpportunityFormInput, string>>;

export type ParsedOpportunityForm = {
  name: string;
  technology: OpportunityTechnologyValue;
  country: string;
  region: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  targetMw: number | null;
  targetMwh: number | null;
  siteAreaHa: number | null;
  minSiteAreaHa: number | null;
  maxDistanceKm: number | null;
  excludeProtected: boolean;
  excludeNatura: boolean;
  maxSlopePercent: number | null;
  minDistanceResidentialM: number | null;
  notes: string | null;
};

function readString(formData: FormData, key: keyof OpportunityFormInput): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalNumber(
  raw: string,
  field: keyof OpportunityFormInput,
  errors: OpportunityFormFieldErrors,
): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors[field] = "Enter a non-negative number.";
    return null;
  }
  return parsed;
}

export function parseOpportunityForm(formData: FormData): {
  values: OpportunityFormInput;
  parsed: ParsedOpportunityForm | null;
  fieldErrors: OpportunityFormFieldErrors;
} {
  const values: OpportunityFormInput = {
    name: readString(formData, "name"),
    technology: readString(formData, "technology") || "battery_storage",
    country: readString(formData, "country") || "SE",
    region: readString(formData, "region"),
    municipality: readString(formData, "municipality"),
    latitude: readString(formData, "latitude"),
    longitude: readString(formData, "longitude"),
    targetMw: readString(formData, "targetMw"),
    targetMwh: readString(formData, "targetMwh"),
    siteAreaHa: readString(formData, "siteAreaHa"),
    minSiteAreaHa: readString(formData, "minSiteAreaHa"),
    maxDistanceKm: readString(formData, "maxDistanceKm"),
    excludeProtected: formData.get("excludeProtected") === "on" ? "on" : "",
    excludeNatura: formData.get("excludeNatura") === "on" ? "on" : "",
    maxSlopePercent: readString(formData, "maxSlopePercent"),
    minDistanceResidentialM: readString(formData, "minDistanceResidentialM"),
    notes: readString(formData, "notes"),
  };

  const fieldErrors: OpportunityFormFieldErrors = {};
  if (!values.name) fieldErrors.name = "Enter an opportunity name.";
  if (!isOpportunityTechnology(values.technology)) {
    fieldErrors.technology = "Select a valid technology.";
  }

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (values.latitude || values.longitude) {
    latitude = Number(values.latitude);
    longitude = Number(values.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      fieldErrors.latitude = "Enter a latitude between -90 and 90.";
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      fieldErrors.longitude = "Enter a longitude between -180 and 180.";
    }
  }

  const parsed: ParsedOpportunityForm = {
    name: values.name,
    technology: isOpportunityTechnology(values.technology)
      ? values.technology
      : OPPORTUNITY_TECHNOLOGY_VALUES[0],
    country: values.country.slice(0, 8).toUpperCase() || "SE",
    region: values.region || null,
    municipality: values.municipality || null,
    latitude: fieldErrors.latitude ? null : latitude,
    longitude: fieldErrors.longitude ? null : longitude,
    targetMw: parseOptionalNumber(values.targetMw, "targetMw", fieldErrors),
    targetMwh: parseOptionalNumber(values.targetMwh, "targetMwh", fieldErrors),
    siteAreaHa: parseOptionalNumber(values.siteAreaHa, "siteAreaHa", fieldErrors),
    minSiteAreaHa: parseOptionalNumber(values.minSiteAreaHa, "minSiteAreaHa", fieldErrors),
    maxDistanceKm: parseOptionalNumber(values.maxDistanceKm, "maxDistanceKm", fieldErrors),
    excludeProtected: values.excludeProtected === "on",
    excludeNatura: values.excludeNatura === "on",
    maxSlopePercent: parseOptionalNumber(values.maxSlopePercent, "maxSlopePercent", fieldErrors),
    minDistanceResidentialM: parseOptionalNumber(
      values.minDistanceResidentialM,
      "minDistanceResidentialM",
      fieldErrors,
    ),
    notes: values.notes || null,
  };

  if (Object.keys(fieldErrors).length > 0 || !values.name) {
    return { values, parsed: null, fieldErrors };
  }
  return { values, parsed, fieldErrors };
}
