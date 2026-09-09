"use server";

import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getOfficialCoveringSummaryForPoint } from "@/lib/data/official-covering-point";
import { getCurrentOrganization } from "@/lib/data/organization";
import { canCreateOrEditOpportunities, canPromoteOpportunities } from "@/lib/opportunities/authorization";
import {
  OPPORTUNITY_REJECT_REASON_VALUES,
  isOpportunityStatus,
  type OpportunityRejectReasonValue,
  type OpportunityStatusValue,
} from "@/lib/opportunities/catalog";
import { emptyCovering, evaluateOpportunityScreening } from "@/lib/opportunities/screening";
import { parseOpportunityForm, type OpportunityFormFieldErrors, type OpportunityFormInput } from "@/lib/opportunities/validation";
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
  const text = (message ?? "").toLowerCase();
  if (text.includes("not authenticated") || text.includes("no organization")) {
    return "Sign in to manage opportunities.";
  }
  if (text.includes("not allowed") || text.includes("permission") || text.includes("42501")) {
    return "You do not have permission to do that.";
  }
  if (text.includes("already promoted")) {
    return "This opportunity has already been promoted.";
  }
  if (text.includes("coordinates required")) {
    return "Add coordinates before promoting to a project.";
  }
  if (text.includes("rejected")) {
    return "Reopen a rejected opportunity before promoting it.";
  }
  return fallback;
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
      target_mw: parsed.targetMw,
      target_mwh: parsed.targetMwh,
      min_site_area_ha: parsed.minSiteAreaHa,
      max_distance_km: parsed.maxDistanceKm,
      exclude_protected: parsed.excludeProtected,
      exclude_natura: parsed.excludeNatura,
      max_slope_percent: parsed.maxSlopePercent,
      min_distance_residential_m: parsed.minDistanceResidentialM,
      notes: parsed.notes,
      criteria: {
        technology: parsed.technology,
        country: parsed.country,
        region: parsed.region,
        municipality: parsed.municipality,
        targetMw: parsed.targetMw,
        targetMwh: parsed.targetMwh,
        minSiteAreaHa: parsed.minSiteAreaHa,
        maxDistanceKm: parsed.maxDistanceKm,
        excludeProtected: parsed.excludeProtected,
        excludeNatura: parsed.excludeNatura,
        maxSlopePercent: parsed.maxSlopePercent,
        minDistanceResidentialM: parsed.minDistanceResidentialM,
      },
    })
    .select("id")
    .maybeSingle();

  if (searchError || !search?.id) {
    console.error("createOpportunityAction search failed", searchError?.message);
    return { error: publicError(searchError?.message, "Could not save screening criteria."), values };
  }

  const covering =
    parsed.latitude != null && parsed.longitude != null
      ? await getOfficialCoveringSummaryForPoint(parsed.latitude, parsed.longitude)
      : emptyCovering();

  const screening = evaluateOpportunityScreening({
    criteria: {
      technology: parsed.technology,
      country: parsed.country,
      region: parsed.region,
      municipality: parsed.municipality,
      targetMw: parsed.targetMw,
      targetMwh: parsed.targetMwh,
      minSiteAreaHa: parsed.minSiteAreaHa,
      maxDistanceKm: parsed.maxDistanceKm,
      excludeProtected: parsed.excludeProtected,
      excludeNatura: parsed.excludeNatura,
      maxSlopePercent: parsed.maxSlopePercent,
      minDistanceResidentialM: parsed.minDistanceResidentialM,
      notes: parsed.notes,
    },
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
    provider_key: item.sourceKind === "official" ? "ei-official-covering" : null,
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
