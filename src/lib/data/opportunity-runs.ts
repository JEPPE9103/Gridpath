import { cache } from "react";
import { getCurrentOrganization } from "@/lib/data/organization";
import {
  isOpportunityConfidence,
  isOpportunityRecommendation,
  type OpportunityConfidenceValue,
  type OpportunityRecommendationValue,
} from "@/lib/opportunities/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OpportunityRunCandidate = {
  id: string;
  name: string;
  rank: number | null;
  recommendation: OpportunityRecommendationValue;
  recommendationSummary: string | null;
  dataConfidence: OpportunityConfidenceValue;
  excluded: boolean;
  exclusionReason: string | null;
  latitude: number | null;
  longitude: number | null;
  grossAreaHa: number | null;
  usableAreaHa: number | null;
  contiguousAreaHa: number | null;
  protectedOverlapPct: number | null;
  naturaOverlapPct: number | null;
  localCoveringName: string | null;
  nupCoveringName: string | null;
  keyPositive: string | null;
  keyRisk: string | null;
  savedOpportunityId: string | null;
  meanSlopeDeg: number | null;
  p90SlopeDeg: number | null;
  pctBelowSlope: number | null;
  landCover: Record<string, number>;
  roadDistanceM: number | null;
  roadClass: string | null;
  exclusionBreakdown: {
    grossHa?: number;
    protectedHa?: number;
    naturaHa?: number;
    terrainHa?: number;
    landCoverHa?: number;
    remainingHa?: number;
    largestContiguousHa?: number;
    refinementGrossHa?: number;
    refinementLandCoverHa?: number;
    refinementTerrainHa?: number;
    refinementRemainingHa?: number;
    refinementLargestContiguousHa?: number;
  } | null;
  screeningStage: string | null;
  refinementStatus: string | null;
  discoveryRank: number | null;
  detailedRank: number | null;
  terrainResolution: string | null;
  landCoverResolution: string | null;
  terrainProviderKey: string | null;
  landCoverProviderKey: string | null;
  strategicFlags: string[];
  rankChangeExplanation: string | null;
  countyName: string | null;
  municipalityName: string | null;
  transmissionContext: Record<string, unknown> | null;
  discoveryContiguousAreaHa: number | null;
};

export type OpportunitySearchRunView = {
  kind: "ok" | "missing" | "error";
  searchId: string;
  runId: string;
  searchName: string;
  technology: string;
  electricityArea: string | null;
  status: string;
  methodology: string | null;
  cellSizeM: number | null;
  evaluatedCount: number;
  excludedCount: number;
  returnedCount: number;
  durationMs: number | null;
  warnings: string[];
  providerAvailability: Record<string, boolean>;
  rankingVersion: string | null;
  methodologyVersion: string | null;
  screeningStage: string | null;
  changeSummary: string | null;
  previousRun: { id: string; returnedCount: number; evaluatedCount: number } | null;
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
  candidates: OpportunityRunCandidate[];
  geojson: unknown;
};

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const getOpportunitySearchRun = cache(
  async (searchId: string, runId: string): Promise<OpportunitySearchRunView | null> => {
    const organization = await getCurrentOrganization();
    if (!organization) return null;
    const supabase = await createSupabaseServerClient();

    const { data: run, error } = await supabase
      .from("opportunity_search_runs")
      .select(
        "id, search_id, status, methodology, cell_size_m, evaluated_count, excluded_count, returned_count, duration_ms, warnings, provider_availability, previous_run_id, west, south, east, north, ranking_version, methodology_version, change_summary, screening_stage",
      )
      .eq("id", runId)
      .eq("search_id", searchId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (error || !run) return null;

    const { data: search } = await supabase
      .from("opportunity_searches")
      .select("id, name, technology, electricity_area")
      .eq("id", searchId)
      .eq("organization_id", organization.id)
      .maybeSingle();

    const { data: previous } = run.previous_run_id
      ? await supabase
          .from("opportunity_search_runs")
          .select("id, returned_count, evaluated_count")
          .eq("id", run.previous_run_id)
          .eq("organization_id", organization.id)
          .maybeSingle()
      : { data: null };

    const { data: candidates } = await supabase
      .from("opportunity_run_candidates")
      .select(
        "id, name, rank, recommendation, recommendation_summary, data_confidence, excluded, exclusion_reason, latitude, longitude, gross_area_ha, usable_area_ha, contiguous_area_ha, protected_overlap_pct, natura_overlap_pct, local_covering_name, nup_covering_name, key_positive, key_risk, saved_opportunity_id, mean_slope_deg, p90_slope_deg, pct_below_slope, land_cover, road_distance_m, road_class, exclusion_breakdown, screening_stage, refinement_status, discovery_rank, detailed_rank, terrain_resolution, land_cover_resolution, terrain_provider_key, land_cover_provider_key, strategic_flags, rank_change_explanation, county_name, municipality_name, transmission_context, discovery_contiguous_area_ha",
      )
      .eq("run_id", runId)
      .eq("organization_id", organization.id)
      .order("rank", { ascending: true });

    const { data: geojson } = await supabase.rpc("get_opportunity_run_geojson", { p_run_id: runId });

    const warnings = Array.isArray(run.warnings)
      ? (run.warnings as unknown[]).filter((item): item is string => typeof item === "string")
      : [];

    return {
      kind: "ok",
      searchId,
      runId,
      searchName: search?.name || "Opportunity search",
      technology: search?.technology || "battery_storage",
      electricityArea: search?.electricity_area ?? null,
      status: run.status,
      methodology: run.methodology,
      cellSizeM: toNumber(run.cell_size_m),
      evaluatedCount: run.evaluated_count ?? 0,
      excludedCount: run.excluded_count ?? 0,
      returnedCount: run.returned_count ?? 0,
      durationMs: run.duration_ms,
      warnings,
      providerAvailability:
        run.provider_availability && typeof run.provider_availability === "object"
          ? (run.provider_availability as Record<string, boolean>)
          : {},
      rankingVersion: run.ranking_version ?? null,
      methodologyVersion: run.methodology_version ?? null,
      screeningStage: run.screening_stage ?? "discovery",
      changeSummary: run.change_summary ?? null,
      previousRun: previous
        ? {
            id: previous.id,
            returnedCount: previous.returned_count ?? 0,
            evaluatedCount: previous.evaluated_count ?? 0,
          }
        : null,
      west: toNumber(run.west),
      south: toNumber(run.south),
      east: toNumber(run.east),
      north: toNumber(run.north),
      candidates: (candidates ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        rank: row.rank,
        recommendation: isOpportunityRecommendation(row.recommendation)
          ? row.recommendation
          : "insufficient_evidence",
        recommendationSummary: row.recommendation_summary,
        dataConfidence: isOpportunityConfidence(row.data_confidence) ? row.data_confidence : "unknown",
        excluded: row.excluded === true,
        exclusionReason: row.exclusion_reason,
        latitude: row.latitude,
        longitude: row.longitude,
        grossAreaHa: toNumber(row.gross_area_ha),
        usableAreaHa: toNumber(row.usable_area_ha),
        contiguousAreaHa: toNumber(row.contiguous_area_ha),
        protectedOverlapPct: toNumber(row.protected_overlap_pct),
        naturaOverlapPct: toNumber(row.natura_overlap_pct),
        localCoveringName: row.local_covering_name,
        nupCoveringName: row.nup_covering_name,
        keyPositive: row.key_positive,
        keyRisk: row.key_risk,
        savedOpportunityId: row.saved_opportunity_id,
        meanSlopeDeg: toNumber(row.mean_slope_deg),
        p90SlopeDeg: toNumber(row.p90_slope_deg),
        pctBelowSlope: toNumber(row.pct_below_slope),
        landCover:
          row.land_cover && typeof row.land_cover === "object"
            ? (row.land_cover as Record<string, number>)
            : {},
        roadDistanceM: toNumber(row.road_distance_m),
        roadClass: row.road_class,
        exclusionBreakdown:
          row.exclusion_breakdown && typeof row.exclusion_breakdown === "object"
            ? (row.exclusion_breakdown as OpportunityRunCandidate["exclusionBreakdown"])
            : null,
        screeningStage: row.screening_stage ?? null,
        refinementStatus: row.refinement_status ?? null,
        discoveryRank: toNumber(row.discovery_rank),
        detailedRank: toNumber(row.detailed_rank),
        terrainResolution: row.terrain_resolution ?? null,
        landCoverResolution: row.land_cover_resolution ?? null,
        terrainProviderKey: row.terrain_provider_key ?? null,
        landCoverProviderKey: row.land_cover_provider_key ?? null,
        strategicFlags: Array.isArray(row.strategic_flags)
          ? (row.strategic_flags as unknown[]).filter((item): item is string => typeof item === "string")
          : [],
        rankChangeExplanation: row.rank_change_explanation ?? null,
        countyName: row.county_name ?? null,
        municipalityName: row.municipality_name ?? null,
        transmissionContext:
          row.transmission_context && typeof row.transmission_context === "object"
            ? (row.transmission_context as Record<string, unknown>)
            : null,
        discoveryContiguousAreaHa: toNumber(row.discovery_contiguous_area_ha),
      })),
      geojson: geojson ?? { type: "FeatureCollection", features: [] },
    };
  },
);
