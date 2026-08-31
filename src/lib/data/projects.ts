import { getCurrentOrganization } from "@/lib/data/organization";
import {
  confidenceLabel,
  outlookLabel,
  pipelineStageLabel,
  technologyLabel,
} from "@/lib/domain/catalog-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectListItem } from "@/types";

type GridOperatorRow = { name: string };

type ProjectSiteRow = {
  name: string | null;
  location: string | null;
  geom: unknown;
  is_primary: boolean;
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  technology: string | null;
  import_mw: number | string | null;
  export_mw: number | string | null;
  voltage_level: string | null;
  connection_stage: string;
  connection_outlook: string;
  confidence: string;
  target_cod: string | null;
  updated_at: string;
  grid_operators: GridOperatorRow | GridOperatorRow[] | null;
  project_sites: ProjectSiteRow[] | null;
};

export type ListProjectsResult = {
  projects: ProjectListItem[];
  blockedByRls: boolean;
  error: string | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePoint(geom: unknown): { latitude: number; longitude: number } {
  if (!geom) {
    return { latitude: 0, longitude: 0 };
  }

  if (typeof geom === "object" && geom !== null && "coordinates" in geom) {
    const coordinates = (geom as { coordinates?: unknown }).coordinates;
    if (
      Array.isArray(coordinates) &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      return { longitude: coordinates[0], latitude: coordinates[1] };
    }
  }

  if (typeof geom === "string") {
    const match = geom.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { longitude: Number(match[1]), latitude: Number(match[2]) };
    }
  }

  return { latitude: 0, longitude: 0 };
}

function pickPrimarySite(sites: ProjectSiteRow[] | null): ProjectSiteRow | null {
  if (!sites?.length) {
    return null;
  }
  return sites.find((site) => site.is_primary) ?? sites[0] ?? null;
}

function mapProject(row: ProjectRow): ProjectListItem {
  const operator = asSingle(row.grid_operators);
  const site = pickPrimarySite(row.project_sites);
  const point = parsePoint(site?.geom);

  return {
    id: row.slug || row.id,
    name: row.name,
    location: row.location || site?.location || site?.name || "",
    latitude: point.latitude,
    longitude: point.longitude,
    technology: technologyLabel(row.technology),
    importMW: toNumber(row.import_mw),
    exportMW: toNumber(row.export_mw),
    gridOperator: operator?.name ?? "",
    voltageLevel: row.voltage_level ?? "",
    stage: pipelineStageLabel(row.connection_stage),
    outlook: outlookLabel(row.connection_outlook),
    confidence: confidenceLabel(row.confidence),
    targetCOD: row.target_cod ?? "",
    lastUpdated: row.updated_at,
  };
}

export async function listProjects(): Promise<ListProjectsResult> {
  const organization = await getCurrentOrganization();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!organization) {
    if (!user) {
      return { projects: [], blockedByRls: true, error: null };
    }
    return { projects: [], blockedByRls: false, error: null };
  }

  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      slug,
      name,
      location,
      technology,
      import_mw,
      export_mw,
      voltage_level,
      connection_stage,
      connection_outlook,
      confidence,
      target_cod,
      updated_at,
      grid_operators ( name ),
      project_sites!inner ( name, location, geom, is_primary )
    `,
    )
    .eq("organization_id", organization.id)
    .eq("project_sites.is_primary", true)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listProjects failed", error.message);
    const anonymous = !user;
    return {
      projects: [],
      blockedByRls: anonymous,
      error: "Could not load projects. Try again in a moment.",
    };
  }

  const rows = (data ?? []) as ProjectRow[];
  if (!user && rows.length === 0) {
    return {
      projects: [],
      blockedByRls: true,
      error: null,
    };
  }

  return {
    projects: rows.map(mapProject),
    blockedByRls: false,
    error: null,
  };
}
