"use server";

import { listGridOperators } from "@/lib/data/grid-operators";
import { getCurrentOrganization } from "@/lib/data/organization";
import { listProjectDuplicateKeys } from "@/lib/data/projects";
import { parseCsv } from "@/lib/import/csv";
import type { ColumnMapping } from "@/lib/import/mapping";
import { parseXlsx } from "@/lib/import/xlsx";
import {
  summariseImportRows,
  validateImportRows,
  type DuplicateDecision,
  type ValidatedImportRow,
} from "@/lib/import/validate";
import { canImportProjects } from "@/lib/projects/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ImportPreviewState = {
  error?: string;
  filename?: string;
  headers?: string[];
  rows?: string[][];
};

export type ImportCommitResult = {
  ok: boolean;
  error?: string;
  importId?: string;
  successCount?: number;
  skippedCount?: number;
  failedCount?: number;
  addedMw?: number;
  officialMatchCount?: number | null;
  failures?: Array<{ index: number; name: string | null; error: string }>;
};

function revalidateAfterImport() {
  revalidatePath("/portfolio");
  revalidatePath("/overview");
  revalidatePath("/map");
  revalidatePath("/reports");
  revalidatePath("/connections");
  revalidatePath("/documents");
}

export async function parsePortfolioImportFile(formData: FormData): Promise<ImportPreviewState> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { error: "Sign in to import projects." };
  }
  if (!canImportProjects(organization.role)) {
    return { error: "You do not have permission to import projects." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV or XLSX file." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "The file is larger than 5 MB." };
  }

  const name = file.name || "portfolio-import";
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith(".csv") || file.type === "text/csv") {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.headers.length) {
        return { error: "The spreadsheet has no header row." };
      }
      return { filename: name, headers: parsed.headers, rows: parsed.rows };
    }
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const parsed = parseXlsx(buffer);
      if (!parsed.headers.length) {
        return { error: "The spreadsheet has no header row." };
      }
      return { filename: name, headers: parsed.headers, rows: parsed.rows };
    }
    return { error: "Use a CSV or XLSX file." };
  } catch (error) {
    console.error("parsePortfolioImportFile failed", error);
    return { error: "Could not read the spreadsheet." };
  }
}

export async function previewPortfolioImport(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
): Promise<{ error?: string; validated?: ValidatedImportRow[] }> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { error: "Sign in to import projects." };
  }
  if (!canImportProjects(organization.role)) {
    return { error: "You do not have permission to import projects." };
  }
  if (headers.length === 0) {
    return { error: "The spreadsheet has no header row." };
  }

  const [operators, keys] = await Promise.all([listGridOperators(), listProjectDuplicateKeys()]);
  if (keys.error) {
    return { error: "Could not check existing projects for duplicates." };
  }

  return {
    validated: validateImportRows(rows, mapping, keys.keys, operators),
  };
}

export async function commitPortfolioImport(input: {
  filename: string;
  rows: ValidatedImportRow[];
  duplicateDecisions: Record<number, DuplicateDecision>;
}): Promise<ImportCommitResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { ok: false, error: "Sign in to import projects." };
  }
  if (!canImportProjects(organization.role)) {
    return { ok: false, error: "You do not have permission to import projects." };
  }

  const [operators, keys] = await Promise.all([listGridOperators(), listProjectDuplicateKeys()]);
  if (keys.error) {
    return { ok: false, error: "Could not check existing projects for duplicates." };
  }

  const operatorIds = new Set(operators.map((operator) => operator.id));
  const payload: Array<Record<string, unknown>> = [];
  for (const row of input.rows) {
    if (row.issues.includes("Blank row.")) {
      continue;
    }
    const blocking = row.issues.filter((issue) => !issue.startsWith("Duplicate of row"));
    if (blocking.length > 0) {
      continue;
    }
    if (row.duplicateOf && (input.duplicateDecisions[row.rowNumber] ?? "skip") === "skip") {
      continue;
    }
    if (row.latitude < -90 || row.latitude > 90 || row.longitude < -180 || row.longitude > 180) {
      continue;
    }
    if (row.gridOperatorId && !operatorIds.has(row.gridOperatorId)) {
      continue;
    }
    payload.push({
      name: row.name,
      technology: row.technology,
      location: row.region,
      latitude: row.latitude,
      longitude: row.longitude,
      import_mw: row.importMw,
      export_mw: row.exportMw,
      grid_operator_id: row.gridOperatorId,
      connection_stage: row.connectionStage,
      connection_outlook: row.connectionOutlook,
      confidence: row.confidence,
      target_cod: row.targetCod,
      description: row.description,
      region: row.region,
      voltage_level: row.voltageLevel,
    });
  }

  const summary = summariseImportRows(input.rows, input.duplicateDecisions);
  if (payload.length === 0) {
    return {
      ok: false,
      error: "No rows are ready to import. Fix the spreadsheet or choose Import anyway for duplicates.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("import_organization_projects", {
    p_organization_id: organization.id,
    p_filename: input.filename,
    p_rows: payload,
    p_skipped_count: summary.skippedDuplicates,
  });

  if (error || !data) {
    console.error("commitPortfolioImport failed", error?.message);
    const text = (error?.message ?? "").toLowerCase();
    if (text.includes("not allowed")) {
      return { ok: false, error: "You do not have permission to import projects." };
    }
    return { ok: false, error: "Could not import the projects." };
  }

  const result = data as {
    import_id?: string;
    success_count?: number;
    failed_count?: number;
    added_mw?: number;
    official_match_count?: number | null;
    failures?: Array<{ index: number; name: string | null; error: string }>;
  };

  revalidateAfterImport();
  return {
    ok: true,
    importId: result.import_id,
    successCount: result.success_count ?? 0,
    skippedCount: summary.skippedDuplicates,
    failedCount: result.failed_count ?? 0,
    addedMw: Number(result.added_mw ?? 0),
    officialMatchCount: result.official_match_count ?? null,
    failures: result.failures ?? [],
  };
}
