import { getCurrentOrganization } from "@/lib/data/organization";
import { fetchAllInChunks, fetchAllQueryPages } from "@/lib/data/paged-select";
import type {
  GridChangeAreaView,
  GridChangeImpactView,
  GridChangeProjectView,
  GridChangeSourceView,
  GridChangesResult,
  GridSourceBaselineView,
  OfficialChangeImpactCard,
  OfficialChangeImpactCounts,
  OfficialChangeMapTarget,
  OrganizationGridChange,
} from "@/lib/data/grid-changes-types";
import { getOfficialSourceHealth } from "@/lib/data/source-health";
import {
  countOfficialChangeImpacts,
  isOfficialSourceUpdateDelayed,
  canReviewOfficialChangeImpacts,
  summarizeOfficialChange,
} from "@/lib/domain/official-change-summary";
import { toNumber } from "@/lib/data/row-utils";
import {
  changeTypeLabel,
  matchTypeLabel,
  observationChangeKindFromMetadata,
  observationChangeKindLabel,
  observationValueView,
  payloadRecord,
  reviewSummaryLabel,
} from "@/lib/domain/grid-change-presentation";
import {
  confidenceLabel,
  gridAreaTypeLabel,
  gridAuthorityLabel,
  nupPlanningScopeLabel,
  outlookLabel,
  pipelineStageLabel,
} from "@/lib/domain/catalog-labels";
import {
  type ChangeImpactLevel,
  type ChangeMatchType,
  type ChangeReviewStatus,
  type ExternalChangeSeverity,
  type ExternalChangeType,
  type GridAuthorityLevel,
  type GridConfidence,
  OFFICIAL_EI_NUP_SOURCE_SLUG,
  isNoxheimDevelopmentFixtureSource,
  isOfficialEiNetworkAreaSource,
  isOfficialEiNupSource,
} from "@/lib/domain/grid-intelligence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GridChangeSourceClass } from "@/lib/data/grid-changes-types";
import { formatDate } from "@/lib/format";

export type {
  GridChangesResult,
  OrganizationGridChange,
} from "@/lib/data/grid-changes-types";
export {
  CHANGE_REVIEW_FILTERS,
  CHANGE_SEVERITY_FILTERS,
  CHANGE_TYPE_FILTERS,
} from "@/lib/data/grid-changes-types";

type JsonRecord = Record<string, unknown>;

type SourceRow = {
  id: string;
  name: string;
  slug: string;
  publisher: string | null;
  base_url: string | null;
  authority_level: string;
};

type AreaRow = {
  id: string;
  name: string;
  area_type: string;
  metadata: unknown;
};

type SnapshotRow = {
  id: string;
  source_id: string;
  retrieved_at: string;
  published_at: string | null;
  status: string;
};

type ChangeRow = {
  id: string;
  source_id: string;
  previous_snapshot_id: string | null;
  current_snapshot_id: string;
  change_type: string;
  title: string;
  summary: string | null;
  severity: string;
  grid_area_id: string | null;
  detected_at: string;
  published_at: string | null;
  confidence: string;
  source_url: string | null;
  before_value: unknown;
  after_value: unknown;
  metadata: unknown;
};

type ImpactRow = {
  id: string;
  external_change_id: string;
  organization_id: string;
  project_id: string;
  match_type: string;
  impact_level: string;
  reason: string;
  confidence: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  import_mw: number | string | null;
  export_mw: number | string | null;
  connection_stage: string | null;
  connection_outlook: string | null;
};

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function unique(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function classifySource(source: Pick<SourceRow, "slug" | "authority_level">): GridChangeSourceClass {
  if (isNoxheimDevelopmentFixtureSource({ sourceSlug: source.slug })) {
    return "fixture";
  }
  if (
    isOfficialEiNupSource({
      sourceSlug: source.slug,
      authorityLevel: source.authority_level as GridAuthorityLevel,
    }) ||
    isOfficialEiNetworkAreaSource({
      sourceSlug: source.slug,
      authorityLevel: source.authority_level as GridAuthorityLevel,
    })
  ) {
    return "official";
  }
  return "other";
}

function sourceAuthorityLabel(
  source: Pick<SourceRow, "slug" | "authority_level">,
): string {
  if (isNoxheimDevelopmentFixtureSource({ sourceSlug: source.slug })) {
    return "NOXHEIM fixture data";
  }
  return gridAuthorityLabel(source.authority_level);
}

function areaFromRow(row: AreaRow | undefined, hasGeometry: boolean): GridChangeAreaView | null {
  if (!row) {
    return {
      name: "Planning area unavailable",
      areaType: "",
      areaTypeLabel: "—",
      officialCompany: null,
      accountingUnit: null,
      planningScope: null,
      hasGeometry: false,
      missing: true,
    };
  }
  const metadata = asRecord(row.metadata);
  return {
    name: row.name,
    areaType: row.area_type,
    areaTypeLabel: gridAreaTypeLabel(row.area_type),
    officialCompany: asString(metadata.official_operator_name),
    accountingUnit: asString(metadata.accounting_unit),
    planningScope: nupPlanningScopeLabel(asString(metadata.delomrade)),
    hasGeometry,
    missing: false,
  };
}

function mapProject(row: ProjectRow): GridChangeProjectView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.location || "",
    stage: pipelineStageLabel(row.connection_stage),
    outlook: outlookLabel(row.connection_outlook),
    importMW: toNumber(row.import_mw),
    exportMW: toNumber(row.export_mw),
  };
}

async function loadOfficialNupBaseline(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  changeCountBySlug: Map<string, number>,
): Promise<GridSourceBaselineView | null> {
  const { data: source, error: sourceError } = await supabase
    .from("grid_sources")
    .select("id, name, slug, publisher, base_url, authority_level")
    .eq("slug", OFFICIAL_EI_NUP_SOURCE_SLUG)
    .maybeSingle();

  if (sourceError) {
    console.error("loadOfficialNupBaseline source failed", sourceError.message);
    return null;
  }
  if (!source) {
    return null;
  }

  const sourceRow = source as SourceRow;
  const { data: snapshot, error: snapshotError } = await supabase
    .from("source_snapshots")
    .select("id, source_id, retrieved_at, published_at, status")
    .eq("source_id", sourceRow.id)
    .in("status", ["success", "unchanged"])
    .order("retrieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    console.error("loadOfficialNupBaseline snapshot failed", snapshotError.message);
  }

  const latest = (snapshot as SnapshotRow | null) ?? null;
  return {
    slug: sourceRow.slug,
    name: sourceRow.name,
    classification: classifySource(sourceRow),
    baselineEstablished: Boolean(latest),
    lastRetrievedAt: latest?.retrieved_at ?? null,
    lastRetrievedAtLabel: latest?.retrieved_at ? formatDate(latest.retrieved_at) : null,
    lastPublishedAt: latest?.published_at ?? null,
    changeCount: changeCountBySlug.get(sourceRow.slug) ?? 0,
  };
}

function asFiniteFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function getGridChangesForCurrentOrganization(): Promise<GridChangesResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const impactsPage = await fetchAllQueryPages<ImpactRow>(async (from, to) => {
    const page = await supabase
      .from("change_impacts")
      .select(
        "id, external_change_id, organization_id, project_id, match_type, impact_level, reason, confidence, review_status, reviewed_at, reviewed_by, review_note",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .range(from, to);
    return { data: page.data as ImpactRow[] | null, error: page.error };
  });

  if (impactsPage.error) {
    console.error("getGridChangesForCurrentOrganization impacts failed", impactsPage.error);
    return { kind: "error", message: "Could not load changes." };
  }

  const impactRows = impactsPage.rows;
  const changeIds = unique(impactRows.map((row) => row.external_change_id));
  const projectIds = unique(impactRows.map((row) => row.project_id));

  let changeRows: ChangeRow[] = [];
  if (changeIds.length > 0) {
    const changesPage = await fetchAllInChunks<ChangeRow>(changeIds, async (chunk) => {
      const page = await supabase
        .from("external_changes")
        .select(
          "id, source_id, previous_snapshot_id, current_snapshot_id, change_type, title, summary, severity, grid_area_id, detected_at, published_at, confidence, source_url, before_value, after_value, metadata, observation_external_id",
        )
        .in("id", chunk)
        .order("detected_at", { ascending: false });
      return { data: page.data as ChangeRow[] | null, error: page.error };
    });
    if (changesPage.error) {
      console.error("getGridChangesForCurrentOrganization changes failed", changesPage.error);
      return { kind: "error", message: "Could not load changes." };
    }
    changeRows = changesPage.rows;
  }

  const sourceIds = unique(changeRows.map((row) => row.source_id));
  const areaIds = unique(changeRows.map((row) => row.grid_area_id));
  const snapshotIds = unique([
    ...changeRows.map((row) => row.previous_snapshot_id),
    ...changeRows.map((row) => row.current_snapshot_id),
  ]);

  const [sourcesResult, areasResult, geometryResult, snapshotsResult, projectsResult] =
    await Promise.all([
      sourceIds.length
        ? fetchAllInChunks<SourceRow>(sourceIds, async (chunk) => {
            const page = await supabase
              .from("grid_sources")
              .select("id, name, slug, publisher, base_url, authority_level")
              .in("id", chunk);
            return { data: page.data as SourceRow[] | null, error: page.error };
          })
        : Promise.resolve({ rows: [] as SourceRow[], error: null }),
      areaIds.length
        ? fetchAllInChunks<AreaRow>(areaIds, async (chunk) => {
            const page = await supabase
              .from("grid_areas")
              .select("id, name, area_type, metadata")
              .in("id", chunk);
            return { data: page.data as AreaRow[] | null, error: page.error };
          })
        : Promise.resolve({ rows: [] as AreaRow[], error: null }),
      areaIds.length
        ? fetchAllInChunks<{ id: string }>(areaIds, async (chunk) => {
            const page = await supabase
              .from("grid_areas")
              .select("id")
              .in("id", chunk)
              .not("geometry", "is", null);
            return { data: page.data as Array<{ id: string }> | null, error: page.error };
          })
        : Promise.resolve({ rows: [] as Array<{ id: string }>, error: null }),
      snapshotIds.length
        ? fetchAllInChunks<SnapshotRow>(snapshotIds, async (chunk) => {
            const page = await supabase
              .from("source_snapshots")
              .select("id, source_id, retrieved_at, published_at, status")
              .in("id", chunk);
            return { data: page.data as SnapshotRow[] | null, error: page.error };
          })
        : Promise.resolve({ rows: [] as SnapshotRow[], error: null }),
      projectIds.length
        ? fetchAllInChunks<ProjectRow>(projectIds, async (chunk) => {
            const page = await supabase
              .from("projects")
              .select("id, slug, name, location, import_mw, export_mw, connection_stage, connection_outlook")
              .eq("organization_id", organization.id)
              .in("id", chunk);
            return { data: page.data as ProjectRow[] | null, error: page.error };
          })
        : Promise.resolve({ rows: [] as ProjectRow[], error: null }),
    ]);

  const reviewerIds = unique(impactRows.map((row) => row.reviewed_by));
  const profilesResult =
    reviewerIds.length > 0
      ? await fetchAllInChunks<{ id: string; full_name: string | null }>(reviewerIds, async (chunk) => {
          const page = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", chunk);
          return { data: page.data as Array<{ id: string; full_name: string | null }> | null, error: page.error };
        })
      : { rows: [] as Array<{ id: string; full_name: string | null }>, error: null };

  if (
    sourcesResult.error ||
    areasResult.error ||
    geometryResult.error ||
    snapshotsResult.error ||
    projectsResult.error ||
    profilesResult.error
  ) {
    console.error(
      "getGridChangesForCurrentOrganization related lookup failed",
      sourcesResult.error ??
        areasResult.error ??
        geometryResult.error ??
        snapshotsResult.error ??
        projectsResult.error ??
        profilesResult.error,
    );
    return { kind: "error", message: "Could not load changes." };
  }

  const sources = new Map(sourcesResult.rows.map((row) => [row.id, row]));
  const areas = new Map(areasResult.rows.map((row) => [row.id, row]));
  const areasWithGeometry = new Set(geometryResult.rows.map((row) => row.id));
  const snapshots = new Map(snapshotsResult.rows.map((row) => [row.id, row]));
  const projects = new Map(projectsResult.rows.map((row) => [row.id, mapProject(row)]));
  const reviewers = new Map(profilesResult.rows.map((row) => [row.id, row.full_name]));

  const impactsByChange = new Map<string, GridChangeImpactView[]>();
  for (const row of impactRows) {
    if (row.organization_id !== organization.id) {
      continue;
    }
    const list = impactsByChange.get(row.external_change_id) ?? [];
    list.push({
      id: row.id,
      project: projects.get(row.project_id) ?? null,
      matchType: row.match_type as ChangeMatchType,
      matchTypeLabel: matchTypeLabel(row.match_type),
      impactLevel: row.impact_level as ChangeImpactLevel,
      reason: row.reason,
      confidence: row.confidence as GridConfidence,
      confidenceLabel: confidenceLabel(row.confidence),
      reviewStatus: row.review_status as ChangeReviewStatus,
      reviewedAt: row.reviewed_at,
      reviewedByName: row.reviewed_by ? (reviewers.get(row.reviewed_by) ?? null) : null,
      reviewNote: row.review_note,
    });
    impactsByChange.set(row.external_change_id, list);
  }

  const changes: OrganizationGridChange[] = [];
  const changeCountBySlug = new Map<string, number>();

  for (const row of changeRows) {
    const impacts = impactsByChange.get(row.id) ?? [];
    if (impacts.length === 0) {
      continue;
    }

    const sourceRow = sources.get(row.source_id);
    if (!sourceRow) {
      continue;
    }

    const classification = classifySource(sourceRow);
    const metadata = asRecord(row.metadata);
    const beforeValue = payloadRecord(row.before_value);
    const afterValue = payloadRecord(row.after_value);
    const changeKind = observationChangeKindFromMetadata(metadata, beforeValue, afterValue);
    const previousSnapshot = row.previous_snapshot_id
      ? snapshots.get(row.previous_snapshot_id)
      : undefined;
    const currentSnapshot = snapshots.get(row.current_snapshot_id);
    const area =
      row.grid_area_id == null
        ? null
        : areaFromRow(areas.get(row.grid_area_id), areasWithGeometry.has(row.grid_area_id));
    const sourceUrl = asString(row.source_url) ?? asString(sourceRow.base_url);
    const sourceView: GridChangeSourceView = {
      name: sourceRow.name,
      slug: sourceRow.slug,
      publisher:
        classification === "fixture"
          ? sourceRow.publisher || "NOXHEIM local development"
          : sourceRow.publisher,
      authorityLevel: sourceRow.authority_level as GridAuthorityLevel,
      authorityLabel: sourceAuthorityLabel(sourceRow),
      classification,
      baseUrl: sourceRow.base_url,
      sourceUrl,
    };

    const beforeView = changeKind === "added" ? null : observationValueView(beforeValue);
    const afterView = changeKind === "removed" ? null : observationValueView(afterValue);
    const year =
      asString(afterValue?.year) ??
      asString(beforeValue?.year) ??
      (typeof afterValue?.year === "number" ? String(afterValue.year) : null);
    const semantic =
      asString(metadata.semantic) ?? asString(afterValue?.semantic) ?? asString(beforeValue?.semantic);

    changes.push({
      id: row.id,
      title: row.title,
      summary: row.summary,
      deterministicSummary: summarizeOfficialChange({
        kind: changeKind,
        semantic,
        before: beforeView
          ? {
              display: beforeView.display,
              year,
              semantic,
            }
          : beforeValue
            ? { valueNumeric: asFiniteFromUnknown(beforeValue.value_numeric), valueText: asString(beforeValue.value_text), unit: asString(beforeValue.unit), year, semantic }
            : null,
        after: afterView
          ? {
              display: afterView.display,
              year,
              semantic,
            }
          : afterValue
            ? { valueNumeric: asFiniteFromUnknown(afterValue.value_numeric), valueText: asString(afterValue.value_text), unit: asString(afterValue.unit), year, semantic }
            : null,
      }),
      changeType: row.change_type as ExternalChangeType,
      changeTypeLabel: changeTypeLabel(row.change_type),
      severity: row.severity as ExternalChangeSeverity,
      detectedAt: row.detected_at,
      detectedAtLabel: formatDate(row.detected_at),
      publishedAt: row.published_at,
      publishedAtLabel: row.published_at ? formatDate(row.published_at) : null,
      changeKind,
      changeKindLabel: observationChangeKindLabel(changeKind),
      before: beforeView,
      after: afterView,
      source: sourceView,
      area,
      areaId: row.grid_area_id,
      impacts,
      affectedProjectCount: impacts.length,
      reviewSummary: reviewSummaryLabel(impacts.map((impact) => impact.reviewStatus)),
      provenance: {
        publisher: sourceView.publisher,
        sourceName: sourceView.name,
        authorityLabel: sourceView.authorityLabel,
        planningAreaName: area?.missing ? null : (area?.name ?? null),
        previousSnapshotAt: previousSnapshot?.retrieved_at ?? null,
        previousSnapshotAtLabel: previousSnapshot?.retrieved_at
          ? formatDate(previousSnapshot.retrieved_at)
          : "—",
        currentSnapshotAt: currentSnapshot?.retrieved_at ?? null,
        currentSnapshotAtLabel: currentSnapshot?.retrieved_at
          ? formatDate(currentSnapshot.retrieved_at)
          : "—",
        detectedBy: "NOXHEIM",
        confidence: row.confidence as GridConfidence,
        confidenceLabel: confidenceLabel(row.confidence),
        officialSourceUrl: classification === "fixture" ? null : sourceUrl,
      },
    });

    changeCountBySlug.set(sourceRow.slug, (changeCountBySlug.get(sourceRow.slug) ?? 0) + 1);
  }

  changes.sort(
    (left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime(),
  );

  const officialBaseline = await loadOfficialNupBaseline(supabase, changeCountBySlug);
  const sourceBaselines: GridSourceBaselineView[] = [];
  if (officialBaseline) {
    sourceBaselines.push(officialBaseline);
  }
  for (const change of changes) {
    if (sourceBaselines.some((item) => item.slug === change.source.slug)) {
      continue;
    }
    sourceBaselines.push({
      slug: change.source.slug,
      name: change.source.name,
      classification: change.source.classification,
      baselineEstablished: Boolean(change.provenance.currentSnapshotAt),
      lastRetrievedAt: change.provenance.currentSnapshotAt,
      lastRetrievedAtLabel: change.provenance.currentSnapshotAtLabel === "—"
        ? null
        : change.provenance.currentSnapshotAtLabel,
      lastPublishedAt: change.publishedAt,
      changeCount: changeCountBySlug.get(change.source.slug) ?? 0,
    });
  }

  const impacts: OfficialChangeImpactCard[] = [];
  for (const change of changes) {
    for (const impact of change.impacts) {
      impacts.push({ impact, change });
    }
  }
  impacts.sort((left, right) => {
    if (left.impact.reviewStatus !== right.impact.reviewStatus) {
      const rank = { unreviewed: 0, confirmed: 1, dismissed: 2 } as const;
      return rank[left.impact.reviewStatus] - rank[right.impact.reviewStatus];
    }
    return new Date(right.change.detectedAt).getTime() - new Date(left.change.detectedAt).getTime();
  });

  const counts = countOfficialChangeImpacts(
    impactRows
      .filter((row) => row.organization_id === organization.id)
      .map((row) => ({ reviewStatus: row.review_status, projectId: row.project_id })),
  );
  const health = await getOfficialSourceHealth();

  return {
    kind: "ok",
    changes,
    impacts,
    counts,
    sourceBaselines,
    sourceHealth: health.map((item) => ({
      slug: item.slug,
      name: item.name,
      healthLabel: item.healthLabel,
      delayed: isOfficialSourceUpdateDelayed(item.health),
      changeLabel: item.changeLabel,
    })),
    canWrite: canReviewOfficialChangeImpacts(organization.role),
  };
}

export async function getOfficialChangeImpactCounts(
  projectId?: string,
): Promise<OfficialChangeImpactCounts> {
  const empty = { unreviewed: 0, confirmed: 0, dismissed: 0, unreviewedProjectCount: 0 };
  const organization = await getCurrentOrganization();
  if (!organization) return empty;
  const supabase = await createSupabaseServerClient();

  const scopedCount = (status: string) => {
    let query = supabase
      .from("change_impacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("review_status", status);
    if (projectId) query = query.eq("project_id", projectId);
    return query;
  };

  const [unreviewedResult, confirmedResult, dismissedResult, unreviewedProjectsResult] =
    await Promise.all([
      scopedCount("unreviewed"),
      scopedCount("confirmed"),
      scopedCount("dismissed"),
      projectId
        ? Promise.resolve({ data: [] as Array<{ project_id: string }>, error: null })
        : supabase
            .from("change_impacts")
            .select("project_id")
            .eq("organization_id", organization.id)
            .eq("review_status", "unreviewed"),
    ]);

  if (unreviewedResult.error || confirmedResult.error || dismissedResult.error || unreviewedProjectsResult.error) {
    console.error(
      "getOfficialChangeImpactCounts failed",
      unreviewedResult.error?.message ??
        confirmedResult.error?.message ??
        dismissedResult.error?.message ??
        unreviewedProjectsResult.error?.message,
    );
    return empty;
  }

  const unreviewed = unreviewedResult.count ?? 0;
  return {
    unreviewed,
    confirmed: confirmedResult.count ?? 0,
    dismissed: dismissedResult.count ?? 0,
    unreviewedProjectCount: projectId
      ? unreviewed > 0
        ? 1
        : 0
      : new Set(
          ((unreviewedProjectsResult.data ?? []) as Array<{ project_id: string }>).map(
            (row) => row.project_id,
          ),
        ).size,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getUnreviewedOfficialChangeCountsByProject(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const organization = await getCurrentOrganization();
  if (!organization) return counts;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("change_impacts")
    .select("project_id")
    .eq("organization_id", organization.id)
    .eq("review_status", "unreviewed");
  if (error) {
    console.error("getUnreviewedOfficialChangeCountsByProject failed", error.message);
    return counts;
  }
  for (const row of (data ?? []) as Array<{ project_id: string }>) {
    counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
  }
  return counts;
}

export async function getOfficialChangeMapTarget(
  impactId: string,
): Promise<OfficialChangeMapTarget | null> {
  const organization = await getCurrentOrganization();
  if (!organization || !UUID_PATTERN.test(impactId.trim())) return null;
  const supabase = await createSupabaseServerClient();
  const { data: impact, error: impactError } = await supabase
    .from("change_impacts")
    .select("id, organization_id, project_id, external_change_id")
    .eq("id", impactId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (impactError || !impact) return null;
  const [{ data: project }, { data: change }] = await Promise.all([
    supabase.from("projects").select("slug").eq("id", impact.project_id).maybeSingle(),
    supabase
      .from("external_changes")
      .select("grid_area_id")
      .eq("id", impact.external_change_id)
      .maybeSingle(),
  ]);
  let layer: "local_network" | "planning_area" = "planning_area";
  if (change?.grid_area_id) {
    const { data: area } = await supabase
      .from("grid_areas")
      .select("area_type")
      .eq("id", change.grid_area_id)
      .maybeSingle();
    if (area?.area_type === "local_network") layer = "local_network";
  }
  return {
    projectSlug: typeof project?.slug === "string" ? project.slug : null,
    areaId: typeof change?.grid_area_id === "string" ? change.grid_area_id : null,
    layer,
  };
}
