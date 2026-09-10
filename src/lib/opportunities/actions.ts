"use server";

import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getOfficialCoveringSummaryForPoint } from "@/lib/data/official-covering-point";
import { getCurrentOrganization } from "@/lib/data/organization";
import { canCreateOrEditOpportunities, canPromoteOpportunities } from "@/lib/opportunities/authorization";
import {
  OPPORTUNITY_REJECT_REASON_VALUES,
  isOpportunityStatus,
  isOpportunityTechnology,
  type OpportunityRejectReasonValue,
  type OpportunityStatusValue,
} from "@/lib/opportunities/catalog";
import { rankScreeningCells } from "@/lib/opportunities/run-ranking";
import { METHODOLOGY_VERSION, RANKING_VERSION } from "@/lib/opportunities/screening-profiles";
import { emptyCovering, evaluateOpportunityScreening, type ScreeningCriteria } from "@/lib/opportunities/screening";
import { publicOpportunityError } from "@/lib/opportunities/copy";
import { parseOpportunityForm, type OpportunityFormFieldErrors, type OpportunityFormInput, type ParsedOpportunityForm } from "@/lib/opportunities/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type OpportunityMutationState = {
  error?: string;
  fieldErrors?: OpportunityFormFieldErrors;
  values?: OpportunityFormInput;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function revalidateOpportunityPaths(slug?: string) {
  revalidatePath("/opportunities");
  revalidatePath("/overview");
  revalidatePath("/portfolio");
  revalidatePath("/map");
  revalidatePath("/reports");
  if (slug) {
    revalidatePath(`/opportunities/${slug}`);
  }
}

function publicError(message: string | undefined, fallback: string): string {
  return publicOpportunityError(message, fallback);
}

function screeningCriteriaFromParsed(parsed: ParsedOpportunityForm): ScreeningCriteria {
  return {
    technology: parsed.technology,
    country: parsed.country,
    region: parsed.region,
    municipality: parsed.municipality,
    targetMw: parsed.targetMw,
    targetMwh: parsed.targetMwh,
    minSiteAreaHa: parsed.minSiteAreaHa,
    targetSiteAreaHa: parsed.targetSiteAreaHa,
    maxCandidateAreaHa: parsed.maxCandidateAreaHa,
    maxReturnedCandidates: parsed.maxReturnedCandidates,
    maxDistanceKm: parsed.maxDistanceKm,
    excludeProtected: parsed.excludeProtected,
    excludeNatura: parsed.excludeNatura,
    maxSlopePercent: parsed.maxSlopePercent,
    maxSlopeDegrees: parsed.maxSlopeDegrees,
    slopeMode: parsed.slopeMode,
    landCoverProfile: parsed.landCoverProfile,
    maxRoadDistanceM: parsed.maxRoadDistanceM,
    roadMode: parsed.roadMode,
    minDistanceResidentialM: parsed.minDistanceResidentialM,
    electricityArea: parsed.electricityArea,
    notes: parsed.notes,
    rankingVersion: "suitability-v4",
  };
}

async function applyScreeningRunAssessments(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  runId: string,
  criteria: ScreeningCriteria,
) {
  const { data: rows, error } = await supabase
    .from("opportunity_run_candidates")
    .select(
      "id, name, latitude, longitude, gross_area_ha, usable_area_ha, contiguous_area_ha, protected_overlap_pct, natura_overlap_pct, protected_names, natura_names, local_covering_name, nup_covering_name, covering_queried, protected_queried, natura_queried, mean_slope_deg, median_slope_deg, p90_slope_deg, pct_below_slope, terrain_queried, land_cover, land_cover_queried, road_distance_m, road_class, road_queried, exclusion_breakdown, screening_stage, refinement_status, discovery_rank, detailed_rank, terrain_resolution, land_cover_resolution, terrain_provider_key, land_cover_provider_key, transmission_context, discovery_contiguous_area_ha, compactness, geometry_quality, target_fit_score, candidate_kind",
    )
    .eq("run_id", runId)
    .eq("candidate_kind", "site");
  if (error) {
    throw new Error(error.message);
  }
  const ranked = rankScreeningCells(
    (rows ?? []).map((row) => ({
      ...row,
      transmission:
        row.transmission_context && typeof row.transmission_context === "object"
          ? (row.transmission_context as never)
          : null,
    })),
    criteria,
  );
  const payload = ranked.map((item) => ({
    id: item.id,
    rank: item.rank,
    discoveryRank: item.discoveryRank,
    recommendation: item.recommendation,
    recommendationSummary: item.recommendationSummary,
    dataConfidence: item.dataConfidence,
    excluded: item.excluded,
    exclusionReason: item.exclusionReason,
    keyPositive: item.keyPositive,
    keyRisk: item.keyRisk,
    screening: item.screening,
    rankingVersion: RANKING_VERSION,
    strategicFlags: item.strategicFlags,
    rankChangeExplanation: item.rankChangeExplanation,
  }));
  const { error: applyError } = await supabase.rpc("apply_opportunity_run_assessments", {
    p_run_id: runId,
    p_rows: payload,
  });
  if (applyError) {
    throw new Error(applyError.message);
  }
}

export async function createOpportunityAction(
  _previous: OpportunityMutationState,
  formData: FormData,
): Promise<OpportunityMutationState> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { error: "Sign in to create an opportunity." };
  }
  if (!canCreateOrEditOpportunities(organization.role)) {
    return { error: "You do not have permission to create opportunities." };
  }

  const { values, parsed, fieldErrors } = parseOpportunityForm(formData);
  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const profile = await getCurrentUserProfile();
  const supabase = await createSupabaseServerClient();
  const { data: search, error: searchError } = await supabase
    .from("opportunity_searches")
    .insert({
      organization_id: organization.id,
      created_by: profile?.id ?? null,
      name: parsed.name,
      technology: parsed.technology,
      country: parsed.country,
      region: parsed.region,
      municipality: parsed.municipality,
      electricity_area: parsed.electricityArea,
      west: parsed.bbox?.west ?? null,
      south: parsed.bbox?.south ?? null,
      east: parsed.bbox?.east ?? null,
      north: parsed.bbox?.north ?? null,
      cell_size_m: parsed.cellSizeMeters,
      target_mw: parsed.targetMw,
      target_mwh: parsed.targetMwh,
      min_site_area_ha: parsed.minSiteAreaHa,
      target_site_area_ha: parsed.targetSiteAreaHa,
      max_candidate_area_ha: parsed.maxCandidateAreaHa,
      max_returned_candidates: parsed.maxReturnedCandidates,
      max_distance_km: parsed.maxDistanceKm,
      exclude_protected: parsed.excludeProtected,
      exclude_natura: parsed.excludeNatura,
      max_slope_percent: parsed.maxSlopePercent,
      max_slope_degrees: parsed.maxSlopeDegrees,
      slope_mode: parsed.slopeMode,
      land_cover_rules: parsed.landCoverProfile,
      max_road_distance_m: parsed.maxRoadDistanceM,
      road_mode: parsed.roadMode,
      screening_profile_id: parsed.profileId && UUID_PATTERN.test(parsed.profileId) ? parsed.profileId : null,
      investigation_budget_note: parsed.investigationBudgetNote,
      hurdle_note: parsed.hurdleNote,
      min_distance_residential_m: parsed.minDistanceResidentialM,
      notes: parsed.notes,
      criteria: {
        technology: parsed.technology,
        country: parsed.country,
        region: parsed.region,
        municipality: parsed.municipality,
        electricityArea: parsed.electricityArea,
        bbox: parsed.bbox,
        targetMw: parsed.targetMw,
        targetMwh: parsed.targetMwh,
        minSiteAreaHa: parsed.minSiteAreaHa,
        targetSiteAreaHa: parsed.targetSiteAreaHa,
        maxCandidateAreaHa: parsed.maxCandidateAreaHa,
        maxReturnedCandidates: parsed.maxReturnedCandidates,
        maxDistanceKm: parsed.maxDistanceKm,
        excludeProtected: parsed.excludeProtected,
        excludeNatura: parsed.excludeNatura,
        maxSlopePercent: parsed.maxSlopePercent,
        maxSlopeDegrees: parsed.maxSlopeDegrees,
        slopeMode: parsed.slopeMode,
        landCoverProfile: parsed.landCoverProfile,
        maxRoadDistanceM: parsed.maxRoadDistanceM,
        roadMode: parsed.roadMode,
        minDistanceResidentialM: parsed.minDistanceResidentialM,
        rankingVersion: RANKING_VERSION,
        methodologyVersion: METHODOLOGY_VERSION,
      },
    })
    .select("id")
    .maybeSingle();

  if (searchError || !search?.id) {
    console.error("createOpportunityAction search failed", searchError?.message);
    return { error: publicError(searchError?.message, "Could not save screening criteria."), values };
  }

  if (parsed.saveProfileName && profile?.id) {
    const { error: profileError } = await supabase.from("opportunity_screening_profiles").insert({
      organization_id: organization.id,
      created_by: profile.id,
      name: parsed.saveProfileName,
      origin: "customer",
      technology: parsed.technology,
      criteria: {
        technology: parsed.technology,
        targetMw: parsed.targetMw,
        targetMwh: parsed.targetMwh,
        minSiteAreaHa: parsed.minSiteAreaHa,
        targetSiteAreaHa: parsed.targetSiteAreaHa,
        maxCandidateAreaHa: parsed.maxCandidateAreaHa,
        maxReturnedCandidates: parsed.maxReturnedCandidates,
        excludeProtected: parsed.excludeProtected,
        excludeNatura: parsed.excludeNatura,
        slopeMode: parsed.slopeMode,
        maxSlopeDegrees: parsed.maxSlopeDegrees,
        landCover: parsed.landCoverProfile,
        maxRoadDistanceM: parsed.maxRoadDistanceM,
        roadMode: parsed.roadMode,
        minDistanceResidentialM: parsed.minDistanceResidentialM,
        assumptions: {
          maxInvestigationDistanceKm: parsed.maxDistanceKm,
          investigationBudgetNote: parsed.investigationBudgetNote,
          hurdleNote: parsed.hurdleNote,
        },
      },
    });
    if (profileError) {
      console.error("createOpportunityAction save profile failed", profileError.message);
    }
  }

  const criteria = screeningCriteriaFromParsed(parsed);

  if (parsed.searchMode === "geography" && parsed.bbox) {
    const { data: run, error: runError } = await supabase.rpc("execute_opportunity_screening_run", {
      p_search_id: search.id,
    });
    if (runError || !run) {
      console.error("createOpportunityAction screening run failed", runError?.message);
      return { error: publicError(runError?.message, "Could not run geographic screening."), values };
    }
    const runRow = (Array.isArray(run) ? run[0] : run) as { run_id?: string } | undefined;
    if (!runRow?.run_id) {
      return { error: "Could not run geographic screening.", values };
    }
    const { error: segmentError } = await supabase.rpc("segment_opportunity_run_into_sites", {
      p_run_id: runRow.run_id,
    });
    if (segmentError) {
      console.error("createOpportunityAction site segmentation failed", segmentError.message);
      return { error: publicError(segmentError.message, "Screening ran but site generation failed."), values };
    }
    try {
      await applyScreeningRunAssessments(supabase, runRow.run_id, criteria);
    } catch (error) {
      console.error("createOpportunityAction ranking failed", error);
      return { error: publicError(error instanceof Error ? error.message : undefined, "Screening ran but ranking failed."), values };
    }
    revalidateOpportunityPaths();
    redirect(`/opportunities/searches/${search.id}/runs/${runRow.run_id}`);
  }

  const covering =
    parsed.latitude != null && parsed.longitude != null
      ? await getOfficialCoveringSummaryForPoint(parsed.latitude, parsed.longitude)
      : emptyCovering();

  const screening = evaluateOpportunityScreening({
    criteria,
    candidate: {
      name: parsed.name,
      country: parsed.country,
      region: parsed.region,
      municipality: parsed.municipality,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      targetMw: parsed.targetMw,
      targetMwh: parsed.targetMwh,
      siteAreaHa: parsed.siteAreaHa,
      usableAreaHa: parsed.siteAreaHa,
      technology: parsed.technology,
      covering,
    },
  });

  const { data, error } = await supabase.rpc("create_development_opportunity", {
    p_organization_id: organization.id,
    p_name: parsed.name,
    p_opportunity_type: parsed.technology,
    p_country: parsed.country,
    p_region: parsed.region,
    p_municipality: parsed.municipality,
    p_latitude: parsed.latitude,
    p_longitude: parsed.longitude,
    p_target_mw: parsed.targetMw,
    p_target_mwh: parsed.targetMwh,
    p_site_area_ha: parsed.siteAreaHa,
    p_notes: parsed.notes,
    p_screening_search_id: search.id,
    p_recommendation: screening.recommendation,
    p_recommendation_summary: screening.recommendationSummary,
    p_data_confidence: screening.dataConfidence,
    p_status: screening.status,
  });

  if (error || !data) {
    console.error("createOpportunityAction failed", error?.message);
    return { error: publicError(error?.message, "Could not create the opportunity."), values };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { opportunity_id?: string; slug?: string } | undefined;
  if (!row?.opportunity_id || !row.slug) {
    return { error: "Could not create the opportunity.", values };
  }

  const assessmentRows = screening.dimensions.map((item) => ({
    opportunity_id: row.opportunity_id,
    organization_id: organization.id,
    dimension: item.key,
    result: item.result,
    explanation: item.explanation,
    source_kind: item.sourceKind,
    completeness: item.completeness,
    provider_key:
      item.key === "environmental"
        ? "nv-protected-areas"
        : item.sourceKind === "official"
          ? "ei-official-covering"
          : null,
    evidence: covering,
  }));
  const { error: assessmentError } = await supabase.from("opportunity_assessments").insert(assessmentRows);
  if (assessmentError) {
    console.error("createOpportunityAction assessments failed", assessmentError.message);
  }

  const { error: signalError } = await supabase
    .from("development_opportunities")
    .update({
      key_positive: screening.positives[0] ?? null,
      key_risk: screening.risks[0] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.opportunity_id)
    .eq("organization_id", organization.id);
  if (signalError) {
    console.error("createOpportunityAction signals failed", signalError.message);
  }

  await supabase.from("opportunity_events").insert({
    opportunity_id: row.opportunity_id,
    organization_id: organization.id,
    title: "Screening run",
    detail: screening.recommendationSummary,
    source: "NOXHEIM Analysis",
  });

  revalidateOpportunityPaths(row.slug);
  redirect(`/opportunities/${row.slug}`);
}

export async function updateOpportunityStatusAction(formData: FormData): Promise<void> {
  const organization = await getCurrentOrganization();
  if (!organization || !canCreateOrEditOpportunities(organization.role)) {
    return;
  }
  const id = String(formData.get("opportunityId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!UUID_PATTERN.test(id) || !isOpportunityStatus(status) || status === "promoted") {
    return;
  }
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("development_opportunities")
    .select("id, status, slug")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!existing || existing.status === "promoted") return;

  const nextStatus = status as OpportunityStatusValue;
  if (nextStatus === "rejected") return;

  const { error } = await supabase
    .from("development_opportunities")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organization.id);
  if (error) {
    console.error("updateOpportunityStatusAction failed", error.message);
    return;
  }
  const title =
    nextStatus === "shortlisted"
      ? "Shortlisted"
      : nextStatus === "under_review"
        ? "Moved to under review"
        : "Status changed";
  await supabase.from("opportunity_events").insert({
    opportunity_id: id,
    organization_id: organization.id,
    title,
    detail: `Status set to ${nextStatus}.`,
    source: "Customer Data",
  });
  revalidateOpportunityPaths(slug || existing.slug);
}

export async function rejectOpportunityAction(formData: FormData): Promise<void> {
  const organization = await getCurrentOrganization();
  if (!organization || !canCreateOrEditOpportunities(organization.role)) return;
  const id = String(formData.get("opportunityId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const reason = String(formData.get("reason") ?? "other");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!UUID_PATTERN.test(id)) return;
  if (!(OPPORTUNITY_REJECT_REASON_VALUES as readonly string[]).includes(reason)) return;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("development_opportunities")
    .select("id, status, slug")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!existing || existing.status === "promoted") return;

  const { error } = await supabase
    .from("development_opportunities")
    .update({
      status: "rejected",
      rejection_reason: reason as OpportunityRejectReasonValue,
      rejection_note: note,
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organization.id);
  if (error) {
    console.error("rejectOpportunityAction failed", error.message);
    return;
  }
  await supabase.from("opportunity_events").insert({
    opportunity_id: id,
    organization_id: organization.id,
    title: "Rejected",
    detail: note ? `${reason}: ${note}` : reason,
    source: "Customer Data",
  });
  revalidateOpportunityPaths(slug || existing.slug);
}

export async function reopenOpportunityAction(formData: FormData): Promise<void> {
  const organization = await getCurrentOrganization();
  if (!organization || !canCreateOrEditOpportunities(organization.role)) return;
  const id = String(formData.get("opportunityId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!UUID_PATTERN.test(id)) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("development_opportunities")
    .update({
      status: "identified",
      rejection_reason: null,
      rejection_note: null,
      rejected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("status", "rejected");
  if (error) {
    console.error("reopenOpportunityAction failed", error.message);
    return;
  }
  await supabase.from("opportunity_events").insert({
    opportunity_id: id,
    organization_id: organization.id,
    title: "Reopened",
    detail: "Rejected opportunity was reopened for screening.",
    source: "Customer Data",
  });
  revalidateOpportunityPaths(slug);
}

export async function promoteOpportunityAction(formData: FormData): Promise<void> {
  const organization = await getCurrentOrganization();
  if (!organization || !canPromoteOpportunities(organization.role)) return;
  const id = String(formData.get("opportunityId") ?? "");
  if (!UUID_PATTERN.test(id)) return;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("promote_opportunity_to_project", {
    p_opportunity_id: id,
  });
  if (error || !data) {
    console.error("promoteOpportunityAction failed", error?.message);
    return;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { project_slug?: string } | undefined;
  revalidateOpportunityPaths();
  if (row?.project_slug) {
    revalidatePath(`/projects/${row.project_slug}`);
    redirect(`/projects/${row.project_slug}`);
  }
}

export async function rerunOpportunitySearchAction(formData: FormData): Promise<void> {
  const organization = await getCurrentOrganization();
  if (!organization || !canCreateOrEditOpportunities(organization.role)) return;
  const searchId = String(formData.get("searchId") ?? "");
  if (!UUID_PATTERN.test(searchId)) return;
  const supabase = await createSupabaseServerClient();
  const { data: search, error } = await supabase
    .from("opportunity_searches")
    .select(
      "id, technology, country, region, municipality, electricity_area, target_mw, target_mwh, min_site_area_ha, target_site_area_ha, max_candidate_area_ha, max_returned_candidates, max_distance_km, exclude_protected, exclude_natura, max_slope_percent, max_slope_degrees, slope_mode, land_cover_rules, max_road_distance_m, road_mode, min_distance_residential_m, notes, west",
    )
    .eq("id", searchId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (error || !search?.west) return;

  const { data: run, error: runError } = await supabase.rpc("execute_opportunity_screening_run", {
    p_search_id: searchId,
  });
  if (runError || !run) {
    console.error("rerunOpportunitySearchAction failed", runError?.message);
    return;
  }
  const runRow = (Array.isArray(run) ? run[0] : run) as { run_id?: string } | undefined;
  if (!runRow?.run_id) return;
  const { error: segmentError } = await supabase.rpc("segment_opportunity_run_into_sites", {
    p_run_id: runRow.run_id,
  });
  if (segmentError) {
    console.error("rerunOpportunitySearchAction site segmentation failed", segmentError.message);
    return;
  }

  await applyScreeningRunAssessments(supabase, runRow.run_id, {
    technology: isOpportunityTechnology(search.technology) ? search.technology : "other",
    country: search.country,
    region: search.region,
    municipality: search.municipality,
    targetMw: search.target_mw == null ? null : Number(search.target_mw),
    targetMwh: search.target_mwh == null ? null : Number(search.target_mwh),
    minSiteAreaHa: search.min_site_area_ha == null ? null : Number(search.min_site_area_ha),
    targetSiteAreaHa: search.target_site_area_ha == null ? null : Number(search.target_site_area_ha),
    maxCandidateAreaHa: search.max_candidate_area_ha == null ? null : Number(search.max_candidate_area_ha),
    maxReturnedCandidates:
      search.max_returned_candidates == null ? null : Number(search.max_returned_candidates),
    maxDistanceKm: search.max_distance_km == null ? null : Number(search.max_distance_km),
    excludeProtected: search.exclude_protected,
    excludeNatura: search.exclude_natura,
    maxSlopePercent: search.max_slope_percent == null ? null : Number(search.max_slope_percent),
    maxSlopeDegrees: search.max_slope_degrees == null ? null : Number(search.max_slope_degrees),
    slopeMode: search.slope_mode === "hard" ? "hard" : "preference",
    landCoverProfile: (search.land_cover_rules ?? undefined) as ScreeningCriteria["landCoverProfile"],
    maxRoadDistanceM: search.max_road_distance_m == null ? null : Number(search.max_road_distance_m),
    roadMode: search.road_mode === "hard" ? "hard" : "preference",
    minDistanceResidentialM:
      search.min_distance_residential_m == null ? null : Number(search.min_distance_residential_m),
    electricityArea: search.electricity_area,
    notes: search.notes,
    rankingVersion: RANKING_VERSION,
  });

  revalidateOpportunityPaths();
  redirect(`/opportunities/searches/${searchId}/runs/${runRow.run_id}`);
}

export async function refineOpportunityCandidatesAction(formData: FormData): Promise<void> {
  const organization = await getCurrentOrganization();
  if (!organization || !canCreateOrEditOpportunities(organization.role)) return;
  const runId = String(formData.get("runId") ?? "");
  const searchId = String(formData.get("searchId") ?? "");
  const rawIds = String(formData.get("candidateIds") ?? "");
  const candidateIds = rawIds
    .split(",")
    .map((item) => item.trim())
    .filter((item) => UUID_PATTERN.test(item))
    .slice(0, 5);
  if (!UUID_PATTERN.test(runId) || candidateIds.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("refine_opportunity_run_candidates", {
    p_run_id: runId,
    p_candidate_ids: candidateIds,
  });
  if (error) {
    console.error("refineOpportunityCandidatesAction failed", error.message);
    return;
  }
  const { data: search } = await supabase
    .from("opportunity_searches")
    .select(
      "technology, country, region, municipality, target_mw, target_mwh, min_site_area_ha, target_site_area_ha, max_candidate_area_ha, max_returned_candidates, max_distance_km, exclude_protected, exclude_natura, max_slope_percent, max_slope_degrees, slope_mode, land_cover_rules, max_road_distance_m, road_mode, min_distance_residential_m, electricity_area, notes",
    )
    .eq("id", searchId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (search) {
    await applyScreeningRunAssessments(supabase, runId, {
      technology: isOpportunityTechnology(search.technology) ? search.technology : "other",
      country: search.country,
      region: search.region,
      municipality: search.municipality,
      targetMw: search.target_mw == null ? null : Number(search.target_mw),
      targetMwh: search.target_mwh == null ? null : Number(search.target_mwh),
      minSiteAreaHa: search.min_site_area_ha == null ? null : Number(search.min_site_area_ha),
      targetSiteAreaHa: search.target_site_area_ha == null ? null : Number(search.target_site_area_ha),
      maxCandidateAreaHa: search.max_candidate_area_ha == null ? null : Number(search.max_candidate_area_ha),
      maxReturnedCandidates:
        search.max_returned_candidates == null ? null : Number(search.max_returned_candidates),
      maxDistanceKm: search.max_distance_km == null ? null : Number(search.max_distance_km),
      excludeProtected: search.exclude_protected,
      excludeNatura: search.exclude_natura,
      maxSlopePercent: search.max_slope_percent == null ? null : Number(search.max_slope_percent),
      maxSlopeDegrees: search.max_slope_degrees == null ? null : Number(search.max_slope_degrees),
      slopeMode: search.slope_mode === "hard" ? "hard" : "preference",
      landCoverProfile: (search.land_cover_rules ?? undefined) as ScreeningCriteria["landCoverProfile"],
      maxRoadDistanceM: search.max_road_distance_m == null ? null : Number(search.max_road_distance_m),
      roadMode: search.road_mode === "hard" ? "hard" : "preference",
      minDistanceResidentialM:
        search.min_distance_residential_m == null ? null : Number(search.min_distance_residential_m),
      electricityArea: search.electricity_area,
      notes: search.notes,
      rankingVersion: RANKING_VERSION,
    });
  }
  revalidateOpportunityPaths();
  if (UUID_PATTERN.test(searchId)) {
    redirect(`/opportunities/searches/${searchId}/runs/${runId}`);
  }
}

export async function saveRunCandidateAction(formData: FormData): Promise<void> {
  const organization = await getCurrentOrganization();
  if (!organization || !canCreateOrEditOpportunities(organization.role)) return;
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!UUID_PATTERN.test(candidateId)) return;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_opportunity_from_run_candidate", {
    p_candidate_id: candidateId,
  });
  if (error || !data) {
    console.error("saveRunCandidateAction failed", error?.message);
    return;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { opportunity_id?: string; slug?: string } | undefined;
  if (!row?.opportunity_id || !row.slug) return;

  const { data: candidate } = await supabase
    .from("opportunity_run_candidates")
    .select("screening")
    .eq("id", candidateId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  const screening = candidate?.screening as { dimensions?: Array<{
    key: string;
    result: string;
    explanation: string;
    sourceKind: string;
    completeness: string;
  }> } | null;
  if (screening?.dimensions?.length) {
    await supabase.from("opportunity_assessments").upsert(
      screening.dimensions.map((item) => ({
        opportunity_id: row.opportunity_id,
        organization_id: organization.id,
        dimension: item.key,
        result: item.result,
        explanation: item.explanation,
        source_kind: item.sourceKind,
        completeness: item.completeness,
        provider_key:
          item.key === "environmental"
            ? "nv-protected-areas"
            : item.sourceKind === "official"
              ? "ei-official-covering"
              : null,
        evidence: screening,
      })),
      { onConflict: "opportunity_id,dimension" },
    );
    const { count } = await supabase
      .from("opportunity_assessment_versions")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", row.opportunity_id)
      .eq("organization_id", organization.id);
    await supabase.from("opportunity_assessment_versions").insert({
      opportunity_id: row.opportunity_id,
      organization_id: organization.id,
      version_number: (count ?? 0) + 1,
      ranking_version: RANKING_VERSION,
      methodology_version: METHODOLOGY_VERSION,
      snapshot: screening,
      change_summary: count ? "New assessment version from saved candidate." : "Assessment v1 from saved candidate.",
    });
  }

  revalidateOpportunityPaths(row.slug);
  redirect(`/opportunities/${row.slug}`);
}
