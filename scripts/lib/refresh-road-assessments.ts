import { rankScreeningCells, type ScreeningCellRow } from "../../src/lib/opportunities/run-ranking";
import { defaultScreeningProfile } from "../../src/lib/opportunities/screening-profiles";
import { RANKING_VERSION } from "../../src/lib/opportunities/screening-profiles";
import type { ScreeningCriteria } from "../../src/lib/opportunities/screening";

const CELL_SELECT = `
  id::text as id,
  name,
  latitude,
  longitude,
  gross_area_ha,
  usable_area_ha,
  contiguous_area_ha,
  protected_overlap_pct,
  natura_overlap_pct,
  protected_names,
  natura_names,
  local_covering_name,
  nup_covering_name,
  covering_queried,
  protected_queried,
  natura_queried,
  mean_slope_deg,
  median_slope_deg,
  p90_slope_deg,
  pct_below_slope,
  terrain_queried,
  land_cover,
  land_cover_queried,
  road_distance_m,
  road_class,
  road_queried,
  exclusion_breakdown,
  screening_stage,
  refinement_status,
  discovery_rank,
  detailed_rank,
  terrain_resolution,
  land_cover_resolution,
  terrain_provider_key,
  land_cover_provider_key,
  transmission_context,
  discovery_contiguous_area_ha,
  compactness,
  geometry_quality,
  target_fit_score,
  candidate_kind,
  excluded,
  exclusion_reason
`;

function criteriaForSearch(row: Record<string, unknown>): ScreeningCriteria {
  const pack = defaultScreeningProfile(
    row.technology === "solar" || row.technology === "wind" || row.technology === "hybrid"
      ? row.technology
      : "battery_storage",
  ).criteria;
  return {
    technology: pack.technology,
    country: "SE",
    region: typeof row.region === "string" ? row.region : null,
    municipality: typeof row.municipality === "string" ? row.municipality : null,
    targetMw: null,
    targetMwh: null,
    minSiteAreaHa: Number(row.min_site_area_ha ?? pack.minSiteAreaHa),
    targetSiteAreaHa: Number(row.target_site_area_ha ?? pack.targetSiteAreaHa),
    maxCandidateAreaHa: Number(row.max_candidate_area_ha ?? pack.maxCandidateAreaHa),
    maxReturnedCandidates: Number(row.max_returned_candidates ?? pack.maxReturnedCandidates ?? 25),
    maxDistanceKm: null,
    excludeProtected: row.exclude_protected !== false,
    excludeNatura: row.exclude_natura !== false,
    maxSlopePercent: null,
    maxSlopeDegrees: Number(row.max_slope_degrees ?? pack.maxSlopeDegrees),
    slopeMode: row.slope_mode === "hard" ? "hard" : "preference",
    landCoverProfile: pack.landCover,
    maxRoadDistanceM: Number(row.max_road_distance_m ?? pack.maxRoadDistanceM),
    roadMode: row.road_mode === "hard" ? "hard" : "preference",
    minDistanceResidentialM: null,
    electricityArea: null,
    notes: null,
    rankingVersion: RANKING_VERSION,
  };
}

export function refreshRoadAssessmentsForBbox({
  query,
  quoteSql,
  bbox,
}: {
  query: (sql: string) => unknown;
  quoteSql: (value: string) => string;
  bbox: { west: number; south: number; east: number; north: number };
}) {
  const runs = (query(`
select
  r.id::text as id,
  s.technology,
  s.region,
  s.municipality,
  s.min_site_area_ha,
  s.target_site_area_ha,
  s.max_candidate_area_ha,
  s.max_returned_candidates,
  s.exclude_protected,
  s.exclude_natura,
  s.max_slope_degrees,
  s.slope_mode,
  s.max_road_distance_m,
  s.road_mode
from public.opportunity_search_runs as r
join public.opportunity_searches as s on s.id = r.search_id
where r.west <= ${bbox.east}
  and r.east >= ${bbox.west}
  and r.south <= ${bbox.north}
  and r.north >= ${bbox.south};
`) ?? []) as Array<Record<string, unknown>>;

  let runsUpdated = 0;
  let candidatesRanked = 0;
  for (const run of runs) {
    const runId = String(run.id ?? "");
    if (!runId) continue;
    const rows = (query(`
select ${CELL_SELECT}
from public.opportunity_run_candidates
where run_id = ${quoteSql(runId)}::uuid
  and coalesce(candidate_kind, 'site') = 'site';
`) ?? []) as Array<Record<string, unknown>>;
    if (!rows.length) continue;
    const criteria = criteriaForSearch(run);
    const ranked = rankScreeningCells(
      rows.map((row) => ({
        ...(row as unknown as ScreeningCellRow),
        transmission:
          row.transmission_context && typeof row.transmission_context === "object"
            ? (row.transmission_context as ScreeningCellRow["transmission"])
            : null,
      })),
      criteria,
    );
    for (const item of ranked) {
      query(`
update public.opportunity_run_candidates
set
  rank = ${item.rank},
  recommendation = ${quoteSql(item.recommendation)},
  recommendation_summary = ${quoteSql(item.recommendationSummary)},
  data_confidence = ${quoteSql(item.dataConfidence)},
  excluded = ${item.excluded ? "true" : "false"},
  exclusion_reason = ${item.exclusionReason == null ? "null" : quoteSql(item.exclusionReason)},
  key_positive = ${item.keyPositive == null ? "null" : quoteSql(item.keyPositive)},
  key_risk = ${item.keyRisk == null ? "null" : quoteSql(item.keyRisk)},
  screening = ${quoteSql(JSON.stringify({ ...item.screening, intelligence: item.intelligence }))}::jsonb,
  ranking_version = ${quoteSql(RANKING_VERSION)}
where id = ${quoteSql(item.id)}::uuid
  and run_id = ${quoteSql(runId)}::uuid;
`);
      candidatesRanked += 1;
    }
    runsUpdated += 1;
  }
  return { runsUpdated, candidatesRanked };
}
