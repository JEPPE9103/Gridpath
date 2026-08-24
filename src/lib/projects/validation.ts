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

export type ProjectFormInput = {
  name: string;
  technology: string;
  location: string;
  latitude: string;
  longitude: string;
  importMw: string;
  exportMw: string;
  gridOperatorId: string;
  connectionStage: string;
  connectionOutlook: string;
  confidence: string;
  targetCod: string;
};

export type ProjectFormFieldErrors = Partial<Record<keyof ProjectFormInput, string>>;

export type ParsedProjectForm = {
  name: string;
  technology: (typeof PROJECT_TECHNOLOGY_VALUES)[number];
  location: string | null;
  latitude: number;
  longitude: number;
  importMw: number | null;
  exportMw: number | null;
  gridOperatorId: string | null;
  connectionStage: (typeof PROJECT_STAGE_VALUES)[number];
  connectionOutlook: (typeof PROJECT_OUTLOOK_VALUES)[number];
  confidence: (typeof PROJECT_CONFIDENCE_VALUES)[number];
  targetCod: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readString(formData: FormData, key: keyof ProjectFormInput): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalMw(
  raw: string,
  field: "importMw" | "exportMw",
  errors: ProjectFormFieldErrors,
): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors[field] = "Enter a non-negative megawatt value.";
    return null;
  }
  return parsed;
}

export function parseProjectForm(formData: FormData): {
  values: ProjectFormInput;
  parsed: ParsedProjectForm | null;
  fieldErrors: ProjectFormFieldErrors;
} {
  const values: ProjectFormInput = {
    name: readString(formData, "name"),
    technology: readString(formData, "technology"),
    location: readString(formData, "location"),
    latitude: readString(formData, "latitude"),
    longitude: readString(formData, "longitude"),
    importMw: readString(formData, "importMw"),
    exportMw: readString(formData, "exportMw"),
    gridOperatorId: readString(formData, "gridOperatorId"),
    connectionStage: readString(formData, "connectionStage") || "prospect",
    connectionOutlook: readString(formData, "connectionOutlook") || "unknown",
    confidence: readString(formData, "confidence") || "unknown",
    targetCod: readString(formData, "targetCod"),
  };

  const fieldErrors: ProjectFormFieldErrors = {};

  if (!values.name) {
    fieldErrors.name = "Enter a project name.";
  } else if (values.name.length > 200) {
    fieldErrors.name = "Project name is too long.";
  }

  const technology =
    technologyToDb(values.technology) ??
    (PROJECT_TECHNOLOGY_VALUES.includes(
      values.technology as (typeof PROJECT_TECHNOLOGY_VALUES)[number],
    )
      ? (values.technology as (typeof PROJECT_TECHNOLOGY_VALUES)[number])
      : null);
  if (!technology) {
    fieldErrors.technology = "Select a technology.";
  }

  const latitude = Number(values.latitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    fieldErrors.latitude = "Latitude must be between -90 and 90.";
  }

  const longitude = Number(values.longitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    fieldErrors.longitude = "Longitude must be between -180 and 180.";
  }

  const importMw = parseOptionalMw(values.importMw, "importMw", fieldErrors);
  const exportMw = parseOptionalMw(values.exportMw, "exportMw", fieldErrors);

  let gridOperatorId: string | null = values.gridOperatorId || null;
  if (gridOperatorId && !UUID_PATTERN.test(gridOperatorId)) {
    fieldErrors.gridOperatorId = "Select a valid grid operator.";
    gridOperatorId = null;
  }

  const connectionStage =
    pipelineStageToDb(values.connectionStage) ??
    (PROJECT_STAGE_VALUES.includes(values.connectionStage as (typeof PROJECT_STAGE_VALUES)[number])
      ? (values.connectionStage as (typeof PROJECT_STAGE_VALUES)[number])
      : null);
  if (!connectionStage) {
    fieldErrors.connectionStage = "Select a connection stage.";
  }

  const connectionOutlook =
    outlookToDb(values.connectionOutlook) ??
    (PROJECT_OUTLOOK_VALUES.includes(
      values.connectionOutlook as (typeof PROJECT_OUTLOOK_VALUES)[number],
    )
      ? (values.connectionOutlook as (typeof PROJECT_OUTLOOK_VALUES)[number])
      : null);
  if (!connectionOutlook) {
    fieldErrors.connectionOutlook = "Select a project outlook.";
  }

  const confidence =
    confidenceToDb(values.confidence) ??
    (PROJECT_CONFIDENCE_VALUES.includes(
      values.confidence as (typeof PROJECT_CONFIDENCE_VALUES)[number],
    )
      ? (values.confidence as (typeof PROJECT_CONFIDENCE_VALUES)[number])
      : null);
  if (!confidence) {
    fieldErrors.confidence = "Select a confidence value.";
  }

  if (Object.keys(fieldErrors).length > 0 || !technology || !connectionStage || !connectionOutlook || !confidence) {
    return { values, parsed: null, fieldErrors };
  }

  return {
    values,
    parsed: {
      name: values.name,
      technology,
      location: values.location || null,
      latitude,
      longitude,
      importMw,
      exportMw,
      gridOperatorId,
      connectionStage,
      connectionOutlook,
      confidence,
      targetCod: values.targetCod || null,
    },
    fieldErrors,
  };
}
