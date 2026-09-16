import { coverageGapMessage, onDemandSourcePlan, parseSearchAreaCoverage, type SearchAreaCoverage } from "@/lib/ingest/coverage";
import {
  CONTAMINATION_SOURCE_SLUG,
  COPERNICUS_SOURCE_SLUG,
  FLOOD_SOURCE_SLUG,
  GROUND_SOURCE_SLUG,
  NMD_SOURCE_SLUG,
  PLANNING_SOURCE_SLUG,
  ROADLINK_SOURCE_SLUG,
  clipWindowToSearch,
  contaminationWindows,
  copernicusWindows,
  floodWindows,
  groundWindows,
  nmdWindows,
  planningWindows,
  roadlinkWindows,
  type CoverageWindow,
} from "@/lib/ingest/coverage-keys";
import { copernicusCogUrl, copernicusSnapshotHash, fetchCopernicusTileSummaries } from "@/lib/ingest/copernicus";
import { contaminationSnapshotHash, fetchContaminationFeatures } from "@/lib/ingest/ebh";
import { fetchFloodFeatures, floodSnapshotHash } from "@/lib/ingest/flood";
import { fetchGroundFeatures, groundSnapshotHash } from "@/lib/ingest/ground";
import {
  nmdDiscoverySummariesFromSource,
  nmdSnapshotHash,
  resolveNmd2023Source,
  type NmdRasterSource,
} from "@/lib/ingest/nmd";
import { fetchPlanningFeatures, planningSnapshotHash } from "@/lib/ingest/planning";
import { fetchRoadLinkFeatures, roadlinkSnapshotHash } from "@/lib/ingest/roads";
import { claimIngestWindow, finishIngestWindow, waitForWindow } from "@/lib/ingest/windows";
import type { DiscoveryIngestProgress, DiscoveryProgressStageId, DiscoverySourceRun } from "@/lib/ingest/progress";
import { planningProvidersForBbox } from "@/lib/opportunities/planning-providers";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureCoverageResult = {
  coverage: SearchAreaCoverage | null;
  sources: DiscoverySourceRun[];
  messages: string[];
  reusedCache: boolean;
  fetched: string[];
};

async function loadCoverage(client: SupabaseClient, bbox: SearchBbox): Promise<SearchAreaCoverage | null> {
  const { data, error } = await client.rpc("get_search_area_coverage", {
    p_west: bbox.west,
    p_south: bbox.south,
    p_east: bbox.east,
    p_north: bbox.north,
  });
  if (error) throw new Error(error.message);
  return parseSearchAreaCoverage(data);
}

async function insertSnapshot(
  service: SupabaseClient,
  slug: string,
  hash: string,
  metadata: Record<string, unknown>,
): Promise<string | null> {
  const { data, error } = await service.rpc("insert_official_source_snapshot", {
    p_source_slug: slug,
    p_content_hash: hash,
    p_metadata: metadata,
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

async function upsertPhysical(
  service: SupabaseClient,
  slug: string,
  snapshotId: string | null,
  summaryClass: "terrain" | "land_cover",
  rows: unknown[],
): Promise<number> {
  let count = 0;
  const batch = 40;
  for (let i = 0; i < rows.length; i += batch) {
    const { data, error } = await service.rpc("upsert_official_physical_summaries", {
      p_source_slug: slug,
      p_snapshot_id: snapshotId,
      p_summary_class: summaryClass,
      p_rows: rows.slice(i, i + batch),
    });
    if (error) throw new Error(error.message);
    count += Number(data ?? 0);
  }
  return count;
}

async function upsertRoads(service: SupabaseClient, snapshotId: string | null, rows: unknown[]): Promise<number> {
  let count = 0;
  const batch = 200;
  for (let i = 0; i < rows.length; i += batch) {
    const payload = (rows.slice(i, i + batch) as Array<{ id: string; name: string | null; cls: string | null; geom: unknown }>).map(
      (row) => ({
        id: row.id,
        name: row.name,
        cls: row.cls,
        geom: JSON.stringify(row.geom),
      }),
    );
    const { data, error } = await service.rpc("upsert_official_transport_features", {
      p_source_slug: ROADLINK_SOURCE_SLUG,
      p_snapshot_id: snapshotId,
      p_rows: payload,
    });
    if (error) throw new Error(error.message);
    count += Number(data ?? 0);
  }
  return count;
}

async function upsertFlood(service: SupabaseClient, snapshotId: string | null, rows: unknown[]): Promise<number> {
  let count = 0;
  const batch = 40;
  for (let i = 0; i < rows.length; i += batch) {
    const payload = (
      rows.slice(i, i + batch) as Array<{
        id: string;
        name: string;
        designation: string;
        geom: unknown;
        properties: Record<string, unknown>;
        clipWest?: number;
        clipSouth?: number;
        clipEast?: number;
        clipNorth?: number;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      designation: row.designation,
      geom: JSON.stringify(row.geom),
      properties: row.properties,
      sourceVersion: "msb-bhf",
      clipWest: row.clipWest,
      clipSouth: row.clipSouth,
      clipEast: row.clipEast,
      clipNorth: row.clipNorth,
    }));
    const { data, error } = await service.rpc("upsert_official_geographic_features", {
      p_source_slug: FLOOD_SOURCE_SLUG,
      p_snapshot_id: snapshotId,
      p_feature_class: "mapped_flood",
      p_rows: payload,
    });
    if (error) throw new Error(error.message);
    count += Number(data ?? 0);
  }
  return count;
}

async function upsertGround(service: SupabaseClient, snapshotId: string | null, rows: unknown[]): Promise<number> {
  let count = 0;
  const batch = 80;
  for (let i = 0; i < rows.length; i += batch) {
    const payload = (
      rows.slice(i, i + batch) as Array<{
        id: string;
        name: string;
        designation: string;
        geom: unknown;
        properties: Record<string, unknown>;
        clipWest?: number;
        clipSouth?: number;
        clipEast?: number;
        clipNorth?: number;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      designation: row.designation,
      geom: JSON.stringify(row.geom),
      properties: row.properties,
      sourceVersion: "sgu-jordarter-25k-100k",
      clipWest: row.clipWest,
      clipSouth: row.clipSouth,
      clipEast: row.clipEast,
      clipNorth: row.clipNorth,
    }));
    const { data, error } = await service.rpc("upsert_official_geographic_features", {
      p_source_slug: GROUND_SOURCE_SLUG,
      p_snapshot_id: snapshotId,
      p_feature_class: "mapped_ground",
      p_rows: payload,
    });
    if (error) throw new Error(error.message);
    count += Number(data ?? 0);
  }
  return count;
}

async function upsertContamination(service: SupabaseClient, snapshotId: string | null, rows: unknown[]): Promise<number> {
  let count = 0;
  const batch = 200;
  for (let i = 0; i < rows.length; i += batch) {
    // Points are bbox-filtered in fetch; do not pass clip* (upsert clip path extracts polygons only).
    const payload = (
      rows.slice(i, i + batch) as Array<{
        id: string;
        name: string;
        designation: string;
        geom: unknown;
        properties: Record<string, unknown>;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      designation: row.designation,
      geom: JSON.stringify(row.geom),
      properties: row.properties,
      sourceVersion: CONTAMINATION_SOURCE_SLUG,
    }));
    const { data, error } = await service.rpc("upsert_official_geographic_features", {
      p_source_slug: CONTAMINATION_SOURCE_SLUG,
      p_snapshot_id: snapshotId,
      p_feature_class: "mapped_contamination",
      p_rows: payload,
    });
    if (error) throw new Error(error.message);
    count += Number(data ?? 0);
  }
  return count;
}

async function upsertPlanning(service: SupabaseClient, snapshotId: string | null, rows: unknown[]): Promise<number> {
  let count = 0;
  // Dense plan polygons: larger batches cut RPC round-trips (measured cold-path waste).
  const batch = 120;
  for (let i = 0; i < rows.length; i += batch) {
    const payload = (
      rows.slice(i, i + batch) as Array<{
        id: string;
        name: string;
        designation: string;
        geom: unknown;
        properties: Record<string, unknown>;
        clipWest?: number;
        clipSouth?: number;
        clipEast?: number;
        clipNorth?: number;
        sourceVersion?: string;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      designation: row.designation,
      geom: JSON.stringify(row.geom),
      properties: row.properties,
      sourceVersion: row.sourceVersion ?? PLANNING_SOURCE_SLUG,
      clipWest: row.clipWest,
      clipSouth: row.clipSouth,
      clipEast: row.clipEast,
      clipNorth: row.clipNorth,
    }));
    const { data, error } = await service.rpc("upsert_official_geographic_features", {
      p_source_slug: PLANNING_SOURCE_SLUG,
      p_snapshot_id: snapshotId,
      p_feature_class: "mapped_planning",
      p_rows: payload,
    });
    if (error) throw new Error(error.message);
    count += Number(data ?? 0);
  }
  return count;
}

async function withWindow(
  service: SupabaseClient,
  window: CoverageWindow,
  fetchFn: () => Promise<{ status: "covered" | "partial" | "failed"; version?: string; snapshotId?: string | null; error?: string }>,
): Promise<DiscoverySourceRun> {
  let claimed = await claimIngestWindow(service, window.sourceSlug, window.coverageKey, window.bbox);
  if (claimed.outcome === "covered") {
    return { slug: window.sourceSlug, action: "cache", detail: window.coverageKey };
  }
  if (claimed.outcome === "waiting") {
    claimed = await waitForWindow(service, window.sourceSlug, window.coverageKey, window.bbox);
    if (claimed.outcome === "covered") {
      return { slug: window.sourceSlug, action: "cache", detail: `${window.coverageKey} (waited)` };
    }
    if (claimed.outcome === "waiting") {
      return { slug: window.sourceSlug, action: "waiting", detail: window.coverageKey };
    }
  }
  try {
    const result = await fetchFn();
    await finishIngestWindow(service, window.sourceSlug, window.coverageKey, result.status, {
      sourceVersion: result.version,
      snapshotId: result.snapshotId ?? null,
      error: result.error ?? null,
    });
    if (result.status === "failed") {
      return { slug: window.sourceSlug, action: "failed", detail: result.error ?? window.coverageKey };
    }
    return { slug: window.sourceSlug, action: "fetched", detail: window.coverageKey };
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    await finishIngestWindow(service, window.sourceSlug, window.coverageKey, "failed", { error: message.slice(0, 280) });
    return { slug: window.sourceSlug, action: "failed", detail: message.slice(0, 180) };
  }
}

async function ingestCopernicusWindow(service: SupabaseClient, window: CoverageWindow, search: SearchBbox): Promise<DiscoverySourceRun> {
  const clipped = clipWindowToSearch(window.bbox, search) ?? window.bbox;
  const lat = Math.floor(window.bbox.south);
  const lon = Math.floor(window.bbox.west);
  return withWindow(service, window, async () => {
    const rows = await fetchCopernicusTileSummaries(lat, lon, clipped);
    const snapshotId = await insertSnapshot(service, COPERNICUS_SOURCE_SLUG, copernicusSnapshotHash(clipped, rows.length), {
      publisher: "European Union / Copernicus",
      dataset: "Copernicus DEM GLO-90",
      tile: copernicusCogUrl(lat, lon),
      bbox: clipped,
      summary_count: rows.length,
      product: "DSM 90 m",
    });
    await upsertPhysical(service, COPERNICUS_SOURCE_SLUG, snapshotId, "terrain", rows);
    return { status: rows.length > 0 ? "covered" : "partial", snapshotId, version: "glo90" };
  });
}

async function ingestRoadWindow(service: SupabaseClient, window: CoverageWindow, search: SearchBbox): Promise<DiscoverySourceRun> {
  const clipped = clipWindowToSearch(window.bbox, search) ?? window.bbox;
  return withWindow(service, window, async () => {
    const rows = await fetchRoadLinkFeatures(clipped);
    const snapshotId = await insertSnapshot(service, ROADLINK_SOURCE_SLUG, roadlinkSnapshotHash(clipped, rows.length), {
      publisher: "Trafikverket",
      dataset: "INSPIRE RoadLink / NVDB",
      bbox: clipped,
      feature_count: rows.length,
    });
    await upsertRoads(service, snapshotId, rows);
    return { status: rows.length > 0 ? "covered" : "partial", snapshotId, version: "roadlink" };
  });
}

async function ingestFloodWindow(service: SupabaseClient, window: CoverageWindow, search: SearchBbox): Promise<DiscoverySourceRun> {
  const clipped = clipWindowToSearch(window.bbox, search) ?? window.bbox;
  return withWindow(service, window, async () => {
    const rows = await fetchFloodFeatures(clipped);
    const snapshotId = await insertSnapshot(service, FLOOD_SOURCE_SLUG, floodSnapshotHash(clipped, rows.length, "auto"), {
      publisher: "Myndigheten för civilt försvar / MSB",
      dataset: "Översvämningskartering — beräknat högsta flöde (BHF)",
      layer: "oversvamning:NZ_Oversvamning_BHF",
      bbox: clipped,
      feature_count: rows.length,
      note: "Empty feature_count means the window was evaluated with no mapped BHF polygons.",
    });
    await upsertFlood(service, snapshotId, rows);
    // Covered even when zero polygons — that is an evaluated "no mapped overlap in dataset" result.
    return { status: "covered", snapshotId, version: "msb-bhf" };
  });
}

async function ingestGroundWindow(service: SupabaseClient, window: CoverageWindow, search: SearchBbox): Promise<DiscoverySourceRun> {
  const clipped = clipWindowToSearch(window.bbox, search) ?? window.bbox;
  return withWindow(service, window, async () => {
    const rows = await fetchGroundFeatures(clipped);
    const snapshotId = await insertSnapshot(service, GROUND_SOURCE_SLUG, groundSnapshotHash(clipped, rows.length), {
      publisher: "Sveriges geologiska undersökning (SGU)",
      dataset: "Jordarter 1:25 000–1:100 000 — grundlager",
      collection: "grundlager",
      bbox: clipped,
      feature_count: rows.length,
      map_scale: "1:25 000–1:100 000",
      normalize_version: "sgu-ground-normalize-v1",
      note: "Surficial geology near mapping depth (~0.5 m). Screening-level mapped composition, not a geotechnical investigation.",
    });
    await upsertGround(service, snapshotId, rows);
    return { status: rows.length > 0 ? "covered" : "partial", snapshotId, version: "sgu-jordarter-25k-100k" };
  });
}

async function ingestContaminationWindow(
  service: SupabaseClient,
  window: CoverageWindow,
  search: SearchBbox,
): Promise<DiscoverySourceRun> {
  const clipped = clipWindowToSearch(window.bbox, search) ?? window.bbox;
  return withWindow(service, window, async () => {
    const rows = await fetchContaminationFeatures(clipped);
    const etag =
      typeof rows[0]?.properties?.sourceEtag === "string" ? (rows[0].properties.sourceEtag as string) : null;
    const snapshotId = await insertSnapshot(
      service,
      CONTAMINATION_SOURCE_SLUG,
      contaminationSnapshotHash(clipped, rows.length, etag),
      {
        publisher: "Länsstyrelserna / EBH-stödet",
        dataset: "Potentiellt förorenade områden (extern)",
        bbox: clipped,
        feature_count: rows.length,
        normalize_version: "contamination-normalize-v1",
        note: "Empty feature_count means the window was evaluated with no mapped EBH points. Screening-level environmental-history evidence — not contamination confirmation.",
      },
    );
    await upsertContamination(service, snapshotId, rows);
    // Covered even when zero points — evaluated "no mapped records in dataset".
    return { status: "covered", snapshotId, version: "lst-ebh" };
  });
}

async function ingestPlanningWindow(
  service: SupabaseClient,
  window: CoverageWindow,
  search: SearchBbox,
): Promise<DiscoverySourceRun> {
  const clipped = clipWindowToSearch(window.bbox, search) ?? window.bbox;
  return withWindow(service, window, async () => {
    const rows = await fetchPlanningFeatures(clipped);
    const snapshotId = await insertSnapshot(
      service,
      PLANNING_SOURCE_SLUG,
      planningSnapshotHash(clipped, rows.length),
      {
        publisher: "SBK Malmö stad",
        dataset: "Gällande detaljplaner",
        layer: "SEPlan/Gallande_planer/MapServer/1",
        bbox: clipped,
        feature_count: rows.length,
        normalize_version: "planning-normalize-v1",
        note: "Empty feature_count means the window was evaluated with no mapped detailed-plan polygons. Screening-level municipal planning evidence — not zoning approval.",
      },
    );
    await upsertPlanning(service, snapshotId, rows);
    return { status: "covered", snapshotId, version: "malmo-gallande" };
  });
}

async function ingestNmdWindow(
  service: SupabaseClient,
  window: CoverageWindow,
  search: SearchBbox,
  source: NmdRasterSource,
): Promise<DiscoverySourceRun> {
  const clipped = clipWindowToSearch(window.bbox, search) ?? window.bbox;
  return withWindow(service, window, async () => {
    const { data, error } = await service.rpc("project_bbox_to_sweref99tm", {
      p_west: clipped.west,
      p_south: clipped.south,
      p_east: clipped.east,
      p_north: clipped.north,
    });
    if (error) throw new Error(error.message);
    const extent = data as { xmin?: number; ymin?: number; xmax?: number; ymax?: number };
    if (![extent?.xmin, extent?.ymin, extent?.xmax, extent?.ymax].every((value) => typeof value === "number")) {
      throw new Error("Could not project Search Area to SWEREF 99 TM.");
    }
    const rows = await nmdDiscoverySummariesFromSource(source, {
      xmin: extent.xmin as number,
      ymin: extent.ymin as number,
      xmax: extent.xmax as number,
      ymax: extent.ymax as number,
    });
    const snapshotId = await insertSnapshot(service, NMD_SOURCE_SLUG, nmdSnapshotHash(clipped, rows.length), {
      publisher: "Naturvårdsverket",
      dataset: "NMD2023 basskikt v0.3",
      bbox: clipped,
      summary_count: rows.length,
      resolution: "1km",
      source_kind: source.kind,
    });
    await upsertPhysical(service, NMD_SOURCE_SLUG, snapshotId, "land_cover", rows);
    return { status: rows.length > 0 ? "covered" : "partial", snapshotId, version: "nmd2023-v0.3" };
  });
}

export async function ensureSearchAreaEvidence(input: {
  service: SupabaseClient;
  coverageClient: SupabaseClient;
  bbox: SearchBbox;
  onProgress?: (progress: DiscoveryIngestProgress) => Promise<void> | void;
}): Promise<EnsureCoverageResult> {
  const sources: DiscoverySourceRun[] = [];
  const messages: string[] = [];
  const fetched: string[] = [];

  const emit = async (stage: DiscoveryProgressStageId, extra: string[] = []) => {
    await input.onProgress?.({
      stage,
      messages: [...messages, ...extra],
      sources,
      updatedAt: new Date().toISOString(),
    });
  };

  await emit("preparing");
  await emit("checking");
  const initial = await loadCoverage(input.coverageClient, input.bbox);
  if (!initial) {
    messages.push("Could not determine official evidence coverage for this Search Area.");
    return { coverage: null, sources, messages, reusedCache: false, fetched };
  }

  const plan = onDemandSourcePlan(initial);

  await emit("land_cover");
  const nmdPlan = plan.find((item) => item.slug === NMD_SOURCE_SLUG);
  if (!nmdPlan?.fetch) {
    sources.push({ slug: NMD_SOURCE_SLUG, action: "cache", detail: nmdPlan?.status ?? "covered" });
  } else {
    const nmdSource = resolveNmd2023Source();
    if (!nmdSource) {
      const message =
        "NMD 2023 is not configured on the server (set NOXHEIM_NMD2023_URL to a Cloud Optimized GeoTIFF). Land-cover evidence stays UNKNOWN.";
      messages.push(coverageGapMessage(NMD_SOURCE_SLUG, message));
      sources.push({ slug: NMD_SOURCE_SLUG, action: "failed", detail: "nmd_not_configured" });
    } else {
      for (const window of nmdWindows(input.bbox)) {
        const result = await ingestNmdWindow(input.service, window, input.bbox, nmdSource);
        sources.push(result);
        if (result.action === "fetched") fetched.push(NMD_SOURCE_SLUG);
        if (result.action === "failed") messages.push(coverageGapMessage(NMD_SOURCE_SLUG, result.detail ?? ""));
      }
    }
  }

  await emit("terrain");
  const terrainPlan = plan.find((item) => item.slug === COPERNICUS_SOURCE_SLUG);
  if (!terrainPlan?.fetch) {
    sources.push({ slug: COPERNICUS_SOURCE_SLUG, action: "cache", detail: terrainPlan?.status ?? "covered" });
  } else {
    for (const window of copernicusWindows(input.bbox)) {
      const result = await ingestCopernicusWindow(input.service, window, input.bbox);
      sources.push(result);
      if (result.action === "fetched") fetched.push(COPERNICUS_SOURCE_SLUG);
      if (result.action === "failed") messages.push(coverageGapMessage(COPERNICUS_SOURCE_SLUG, result.detail ?? ""));
    }
  }

  await emit("roads");
  const roadPlan = plan.find((item) => item.slug === ROADLINK_SOURCE_SLUG);
  if (!roadPlan?.fetch) {
    sources.push({ slug: ROADLINK_SOURCE_SLUG, action: "cache", detail: roadPlan?.status ?? "covered" });
  } else {
    for (const window of roadlinkWindows(input.bbox)) {
      const result = await ingestRoadWindow(input.service, window, input.bbox);
      sources.push(result);
      if (result.action === "fetched") fetched.push(ROADLINK_SOURCE_SLUG);
      if (result.action === "failed") messages.push(coverageGapMessage(ROADLINK_SOURCE_SLUG, result.detail ?? ""));
    }
  }

  await emit("flood");
  const floodPlan = plan.find((item) => item.slug === FLOOD_SOURCE_SLUG);
  if (!floodPlan?.fetch) {
    sources.push({ slug: FLOOD_SOURCE_SLUG, action: "cache", detail: floodPlan?.status ?? "covered" });
  } else {
    for (const window of floodWindows(input.bbox)) {
      const result = await ingestFloodWindow(input.service, window, input.bbox);
      sources.push(result);
      if (result.action === "fetched") fetched.push(FLOOD_SOURCE_SLUG);
      if (result.action === "failed") messages.push(coverageGapMessage(FLOOD_SOURCE_SLUG, result.detail ?? ""));
    }
  }

  await emit("ground");
  const groundPlan = plan.find((item) => item.slug === GROUND_SOURCE_SLUG);
  if (!groundPlan?.fetch) {
    sources.push({ slug: GROUND_SOURCE_SLUG, action: "cache", detail: groundPlan?.status ?? "covered" });
  } else {
    for (const window of groundWindows(input.bbox)) {
      const result = await ingestGroundWindow(input.service, window, input.bbox);
      sources.push(result);
      if (result.action === "fetched") fetched.push(GROUND_SOURCE_SLUG);
      if (result.action === "failed") messages.push(coverageGapMessage(GROUND_SOURCE_SLUG, result.detail ?? ""));
    }
  }

  await emit("contamination");
  const contaminationPlan = plan.find((item) => item.slug === CONTAMINATION_SOURCE_SLUG);
  if (!contaminationPlan?.fetch) {
    sources.push({
      slug: CONTAMINATION_SOURCE_SLUG,
      action: "cache",
      detail: contaminationPlan?.status ?? "covered",
    });
  } else {
    for (const window of contaminationWindows(input.bbox)) {
      const result = await ingestContaminationWindow(input.service, window, input.bbox);
      sources.push(result);
      if (result.action === "fetched") fetched.push(CONTAMINATION_SOURCE_SLUG);
      if (result.action === "failed") {
        messages.push(coverageGapMessage(CONTAMINATION_SOURCE_SLUG, result.detail ?? ""));
      }
    }
  }

  await emit("planning");
  const supportedPlanning = planningProvidersForBbox(input.bbox).filter((p) => p.status === "supported");
  if (supportedPlanning.length === 0) {
    sources.push({
      slug: PLANNING_SOURCE_SLUG,
      action: "skipped",
      detail: "no supported municipal planning provider for Search Area",
    });
  } else {
    const planningPlan = plan.find((item) => item.slug === PLANNING_SOURCE_SLUG);
    if (!planningPlan?.fetch) {
      sources.push({
        slug: PLANNING_SOURCE_SLUG,
        action: "cache",
        detail: planningPlan?.status ?? "covered",
      });
    } else {
      for (const window of planningWindows(input.bbox)) {
        const result = await ingestPlanningWindow(input.service, window, input.bbox);
        sources.push(result);
        if (result.action === "fetched") fetched.push(PLANNING_SOURCE_SLUG);
        if (result.action === "failed") {
          messages.push(coverageGapMessage(PLANNING_SOURCE_SLUG, result.detail ?? ""));
        }
      }
    }
  }

  const coverage = await loadCoverage(input.coverageClient, input.bbox);
  return {
    coverage,
    sources,
    messages,
    reusedCache: fetched.length === 0,
    fetched: [...new Set(fetched)],
  };
}
