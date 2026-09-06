import type { ColumnMapping, ImportField } from "@/lib/import/mapping";
import { REQUIRED_IMPORT_FIELDS } from "@/lib/import/mapping";
import {
  normalizeImportConfidence,
  normalizeImportOutlook,
  normalizeImportStage,
  normalizeImportTargetCod,
  normalizeImportTechnology,
  parseImportMw,
  parseImportNumber,
} from "@/lib/import/normalize";

export type ExistingProjectKey = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export type ValidatedImportRow = {
  rowNumber: number;
  name: string;
  latitude: number;
  longitude: number;
  technology: string;
  importMw: number | null;
  exportMw: number | null;
  gridOperatorName: string | null;
  gridOperatorId: string | null;
  connectionStage: string;
  connectionOutlook: string;
  confidence: string;
  targetCod: string | null;
  region: string | null;
  voltageLevel: string | null;
  description: string | null;
  issues: string[];
  duplicateOf: ExistingProjectKey | null;
  duplicateInFile: number | null;
};

const COORD_PRECISION = 5;

export function roundCoord(value: number): number {
  const factor = 10 ** COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

export function nameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function coordKey(latitude: number, longitude: number): string {
  return `${roundCoord(latitude)},${roundCoord(longitude)}`;
}

function cell(row: string[], mapping: ColumnMapping, field: ImportField): string {
  const index = mapping[field];
  if (index == null) {
    return "";
  }
  return (row[index] ?? "").trim();
}

function isBlankRow(row: string[], mapping: ColumnMapping): boolean {
  return REQUIRED_IMPORT_FIELDS.every((field) => !cell(row, mapping, field)) &&
    !cell(row, mapping, "technology") &&
    !cell(row, mapping, "importMw") &&
    !cell(row, mapping, "exportMw") &&
    !cell(row, mapping, "description");
}

export function findDuplicate(
  name: string,
  latitude: number,
  longitude: number,
  existing: ExistingProjectKey[],
): ExistingProjectKey | null {
  const normalisedName = nameKey(name);
  const coordinates = coordKey(latitude, longitude);
  return (
    existing.find((project) => nameKey(project.name) === normalisedName) ??
    existing.find((project) => {
      if (project.latitude == null || project.longitude == null) {
        return false;
      }
      return coordKey(project.latitude, project.longitude) === coordinates;
    }) ??
    null
  );
}

export function validateImportRows(
  rows: string[][],
  mapping: ColumnMapping,
  existing: ExistingProjectKey[],
  operators: Array<{ id: string; name: string }>,
): ValidatedImportRow[] {
  const seenNames = new Map<string, number>();
  const seenCoords = new Map<string, number>();
  const operatorByName = new Map(
    operators.map((operator) => [nameKey(operator.name), operator.id]),
  );

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const issues: string[] = [];
    const name = cell(row, mapping, "name");
    const latitudeRaw = cell(row, mapping, "latitude");
    const longitudeRaw = cell(row, mapping, "longitude");
    const technologyRaw = cell(row, mapping, "technology");
    const importRaw = cell(row, mapping, "importMw");
    const exportRaw = cell(row, mapping, "exportMw");
    const operatorRaw = cell(row, mapping, "gridOperator");
    const stageRaw = cell(row, mapping, "stage");
    const outlookRaw = cell(row, mapping, "outlook");
    const confidenceRaw = cell(row, mapping, "confidence");
    const targetRaw = cell(row, mapping, "targetCod");
    const region = cell(row, mapping, "region") || null;
    const voltageLevel = cell(row, mapping, "voltageLevel") || null;
    const description = cell(row, mapping, "description") || null;

    if (isBlankRow(row, mapping)) {
      issues.push("Blank row.");
    }

    if (!name && !issues.includes("Blank row.")) {
      issues.push("Missing project name.");
    } else if (name.length > 200) {
      issues.push("Project name is too long.");
    }

    const latitude = parseImportNumber(latitudeRaw.replace(",", "."));
    const longitude = parseImportNumber(longitudeRaw.replace(",", "."));
    if (!latitudeRaw && !issues.includes("Blank row.")) {
      issues.push("Missing latitude.");
    } else if (latitude == null || latitude < -90 || latitude > 90) {
      issues.push("Invalid latitude.");
    }
    if (!longitudeRaw && !issues.includes("Blank row.")) {
      issues.push("Missing longitude.");
    } else if (longitude == null || longitude < -180 || longitude > 180) {
      issues.push("Invalid longitude.");
    }

    let technology = "other";
    if (technologyRaw) {
      const normalised = normalizeImportTechnology(technologyRaw);
      if (!normalised) {
        issues.push("Unsupported technology.");
      } else {
        technology = normalised;
      }
    }

    let importMw: number | null = null;
    if (importRaw) {
      importMw = parseImportMw(importRaw);
      if (importMw == null || importMw < 0) {
        issues.push("Malformed import MW.");
        importMw = null;
      }
    }

    let exportMw: number | null = null;
    if (exportRaw) {
      exportMw = parseImportMw(exportRaw);
      if (exportMw == null || exportMw < 0) {
        issues.push("Malformed export MW.");
        exportMw = null;
      }
    }

    let gridOperatorId: string | null = null;
    if (operatorRaw) {
      gridOperatorId = operatorByName.get(nameKey(operatorRaw)) ?? null;
      if (!gridOperatorId) {
        issues.push("Grid operator was not recognised.");
      }
    }

    let connectionStage = "prospect";
    if (stageRaw) {
      const normalised = normalizeImportStage(stageRaw);
      if (!normalised) {
        issues.push("Unsupported stage.");
      } else {
        connectionStage = normalised;
      }
    }

    let connectionOutlook = "unknown";
    if (outlookRaw) {
      const normalised = normalizeImportOutlook(outlookRaw);
      if (!normalised) {
        issues.push("Unsupported outlook.");
      } else {
        connectionOutlook = normalised;
      }
    }

    let confidence = "unknown";
    if (confidenceRaw) {
      const normalised = normalizeImportConfidence(confidenceRaw);
      if (!normalised) {
        issues.push("Impossible or unsupported confidence value.");
      } else {
        confidence = normalised;
      }
    }

    const target = normalizeImportTargetCod(targetRaw);
    if (target.error) {
      issues.push(target.error);
    }

    let duplicateInFile: number | null = null;
    if (name) {
      const existingNameRow = seenNames.get(nameKey(name));
      if (existingNameRow != null) {
        duplicateInFile = existingNameRow;
        issues.push(`Duplicate of row ${existingNameRow} (same project name).`);
      } else {
        seenNames.set(nameKey(name), rowNumber);
      }
    }
    if (latitude != null && longitude != null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      const existingCoordRow = seenCoords.get(coordKey(latitude, longitude));
      if (existingCoordRow != null && duplicateInFile == null) {
        duplicateInFile = existingCoordRow;
        issues.push(`Duplicate of row ${existingCoordRow} (same coordinates).`);
      } else if (existingCoordRow == null) {
        seenCoords.set(coordKey(latitude, longitude), rowNumber);
      }
    }

    const duplicateOf =
      name && latitude != null && longitude != null
        ? findDuplicate(name, latitude, longitude, existing)
        : null;

    return {
      rowNumber,
      name,
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      technology,
      importMw,
      exportMw,
      gridOperatorName: operatorRaw || null,
      gridOperatorId,
      connectionStage,
      connectionOutlook,
      confidence,
      targetCod: target.value,
      region,
      voltageLevel,
      description,
      issues,
      duplicateOf,
      duplicateInFile,
    };
  });
}

export type DuplicateDecision = "skip" | "import";

export function summariseImportRows(
  rows: ValidatedImportRow[],
  duplicateDecisions: Record<number, DuplicateDecision>,
): {
  detected: number;
  ready: number;
  attention: number;
  duplicates: number;
  skippedDuplicates: number;
} {
  const nonBlank = rows.filter((row) => !row.issues.includes("Blank row."));
  const duplicates = nonBlank.filter((row) => row.duplicateOf);
  let skippedDuplicates = 0;
  let ready = 0;
  let attention = 0;
  for (const row of nonBlank) {
    const blocking = row.issues.filter((issue) => !issue.startsWith("Duplicate of row"));
    const isOrgDuplicate = Boolean(row.duplicateOf);
    const decision = duplicateDecisions[row.rowNumber] ?? "skip";
    if (blocking.length > 0) {
      attention += 1;
      continue;
    }
    if (isOrgDuplicate && decision === "skip") {
      skippedDuplicates += 1;
      continue;
    }
    ready += 1;
  }
  return {
    detected: nonBlank.length,
    ready,
    attention,
    duplicates: duplicates.length,
    skippedDuplicates,
  };
}
