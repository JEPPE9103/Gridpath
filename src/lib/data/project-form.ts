import { getCurrentOrganization } from "@/lib/data/organization";
import { toNumber } from "@/lib/data/row-utils";
import type { ProjectFormInput } from "@/lib/projects/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  technology: string | null;
  import_mw: number | string | null;
  export_mw: number | string | null;
  connection_stage: string;
  connection_outlook: string;
  confidence: string;
  target_cod: string | null;
  grid_operator_id: string | null;
};

type CoordinateRow = {
  latitude: number | string | null;
  longitude: number | string | null;
  location: string | null;
};

export type ProjectFormRecord = {
  id: string;
  slug: string;
  values: ProjectFormInput;
};

export async function getProjectFormBySlug(slug: string): Promise<ProjectFormRecord | null> {
  const organization = await getCurrentOrganization();
  if (!organization || !slug.trim()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
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
      connection_stage,
      connection_outlook,
      confidence,
      target_cod,
      grid_operator_id
    `,
    )
    .eq("organization_id", organization.id)
    .eq("slug", slug.trim())
    .maybeSingle();

  if (error) {
    console.error("getProjectFormBySlug failed", error.message);
    return null;
  }
  if (!data) {
    return null;
  }

  const row = data as ProjectRow;
  const { data: coordinateData, error: coordinateError } = await supabase.rpc(
    "primary_site_coordinates",
    { p_project_id: row.id },
  );
  if (coordinateError) {
    console.error("primary_site_coordinates failed", coordinateError.message);
  }

  const coordinate = (
    Array.isArray(coordinateData) ? coordinateData[0] : coordinateData
  ) as CoordinateRow | undefined;
  const latitude = coordinate?.latitude == null ? "" : String(toNumber(coordinate.latitude));
  const longitude = coordinate?.longitude == null ? "" : String(toNumber(coordinate.longitude));

  return {
    id: row.id,
    slug: row.slug,
    values: {
      name: row.name,
      technology: row.technology ?? "",
      location: row.location || coordinate?.location || "",
      latitude,
      longitude,
      importMw: row.import_mw == null ? "" : String(toNumber(row.import_mw)),
      exportMw: row.export_mw == null ? "" : String(toNumber(row.export_mw)),
      gridOperatorId: row.grid_operator_id ?? "",
      connectionStage: row.connection_stage || "prospect",
      connectionOutlook: row.connection_outlook || "unknown",
      confidence: row.confidence || "unknown",
      targetCod: row.target_cod ?? "",
    },
  };
}
