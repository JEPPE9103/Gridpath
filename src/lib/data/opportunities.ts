import { cache } from "react";
import { getCurrentOrganization } from "@/lib/data/organization";
import { fetchAllQueryPages } from "@/lib/data/paged-select";
import { toNumber } from "@/lib/data/row-utils";
import {
  type OpportunityConfidenceValue,
  type OpportunityRecommendationValue,
  type OpportunityStatusValue,
  type OpportunityTechnologyValue,
} from "@/lib/opportunities/catalog";
import { canCreateOrEditOpportunities } from "@/lib/opportunities/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const OPPORTUNITY_PAGE_SIZE = 50;

export type OpportunityListItem = {
  id: string;
  slug: string;
  name: string;
  technology: OpportunityTechnologyValue;
  status: OpportunityStatusValue;
  country: string;
  region: string | null;
  municipality: string | null;
  targetMw: number | null;
  targetMwh: number | null;
  recommendation: OpportunityRecommendationValue;
  recommendationSummary: string | null;
  keyPositive: string | null;
  keyRisk: string | null;
  dataConfidence: OpportunityConfidenceValue;
  latitude: number | null;
  longitude: number | null;
  ownerName: string | null;
  lastUpdated: string;
  promotedProjectId: string | null;
  promotedProjectSlug: string | null;
};

export type OpportunityFunnel = {
  searches: number;
  total: number;
  identified: number;
  screening: number;
  strongCandidates: number;
  underReview: number;
  shortlisted: number;
  rejected: number;
  promoted: number;
};

export type OpportunityOverview = {
  kind: "ok" | "no_organization" | "error";
  error: string | null;
  canWrite: boolean;
  funnel: OpportunityFunnel;
  ranked: OpportunityListItem[];
  recentRejected: OpportunityListItem[];
};

type OpportunityRow = {
  id: string;
  slug: string;
  name: string;
  opportunity_type: string;
  status: string;
  country: string;
  region: string | null;
  municipality: string | null;
  target_mw: number | string | null;
  target_mwh: number | string | null;
  recommendation: string;
  recommendation_summary: string | null;
  key_positive: string | null;
  key_risk: string | null;
  data_confidence: string;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
  promoted_project_id: string | null;
  owner_id: string | null;
};

const EMPTY_FUNNEL: OpportunityFunnel = {
  searches: 0,
  total: 0,
  identified: 0,
  screening: 0,
  strongCandidates: 0,
  underReview: 0,
  shortlisted: 0,
  rejected: 0,
  promoted: 0,
};

function mapRow(
  row: OpportunityRow,
  extras?: { ownerName?: string | null; promotedProjectSlug?: string | null },
): OpportunityListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    technology: row.opportunity_type as OpportunityTechnologyValue,
    status: row.status as OpportunityStatusValue,
    country: row.country,
    region: row.region,
    municipality: row.municipality,
    targetMw: row.target_mw == null ? null : toNumber(row.target_mw),
    targetMwh: row.target_mwh == null ? null : toNumber(row.target_mwh),
    recommendation: row.recommendation as OpportunityRecommendationValue,
    recommendationSummary: row.recommendation_summary,
    keyPositive: row.key_positive,
    keyRisk: row.key_risk,
    dataConfidence: row.data_confidence as OpportunityConfidenceValue,
    latitude: row.latitude,
    longitude: row.longitude,
    ownerName: extras?.ownerName ?? null,
    lastUpdated: row.updated_at,
    promotedProjectId: row.promoted_project_id,
    promotedProjectSlug: extras?.promotedProjectSlug ?? null,
  };
}

export const listOpportunitiesForCurrentOrganization = cache(async (): Promise<{
  items: OpportunityListItem[];
  error: string | null;
}> => {
  const organization = await getCurrentOrganization();
  if (!organization) return { items: [], error: null };
  const supabase = await createSupabaseServerClient();
  const result = await fetchAllQueryPages<OpportunityRow>(async (from, to) => {
    const page = await supabase
      .from("development_opportunities")
      .select(
        "id, slug, name, opportunity_type, status, country, region, municipality, target_mw, target_mwh, recommendation, recommendation_summary, key_positive, key_risk, data_confidence, latitude, longitude, updated_at, promoted_project_id, owner_id",
      )
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false })
      .range(from, to);
    return { data: page.data as OpportunityRow[] | null, error: page.error };
  });
  if (result.error) {
    console.error("listOpportunitiesForCurrentOrganization failed", result.error);
    return { items: [], error: "Could not load opportunities." };
  }
  const ownerIds = [
    ...new Set(result.rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id))),
  ];
  const ownerNames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    if (profileError) {
      console.error("listOpportunitiesForCurrentOrganization profiles failed", profileError.message);
    } else {
      for (const profile of profiles ?? []) {
        const name = profile.full_name?.trim();
        if (name) ownerNames.set(profile.id, name);
      }
    }
  }
  return {
    items: result.rows.map((row) =>
      mapRow(row, { ownerName: row.owner_id ? ownerNames.get(row.owner_id) ?? null : null }),
    ),
    error: null,
  };
});

export const getOpportunityFunnel = cache(async (): Promise<OpportunityFunnel> => {
  const organization = await getCurrentOrganization();
  if (!organization) return EMPTY_FUNNEL;
  const supabase = await createSupabaseServerClient();
  const [{ count: searchCount }, list] = await Promise.all([
    supabase
      .from("opportunity_searches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    listOpportunitiesForCurrentOrganization(),
  ]);
  const funnel = { ...EMPTY_FUNNEL, searches: searchCount ?? 0 };
  for (const item of list.items) {
    funnel.total += 1;
    if (item.status === "identified") funnel.identified += 1;
    if (item.status === "screening") funnel.screening += 1;
    if (item.status === "strong_candidate") funnel.strongCandidates += 1;
    if (item.status === "under_review") funnel.underReview += 1;
    if (item.status === "shortlisted") funnel.shortlisted += 1;
    if (item.status === "rejected") funnel.rejected += 1;
    if (item.status === "promoted") funnel.promoted += 1;
  }
  return funnel;
});

export async function getOpportunityOverview(): Promise<OpportunityOverview> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return {
      kind: "no_organization",
      error: null,
      canWrite: false,
      funnel: EMPTY_FUNNEL,
      ranked: [],
      recentRejected: [],
    };
  }
  const [list, funnel] = await Promise.all([
    listOpportunitiesForCurrentOrganization(),
    getOpportunityFunnel(),
  ]);
  if (list.error) {
    return {
      kind: "error",
      error: list.error,
      canWrite: canCreateOrEditOpportunities(organization.role),
      funnel: EMPTY_FUNNEL,
      ranked: [],
      recentRejected: [],
    };
  }
  const active = list.items.filter((item) => item.status !== "rejected" && item.status !== "promoted");
  const ranked = [...active].sort((left, right) => {
    const rank: Record<string, number> = {
      prioritise: 0,
      investigate: 1,
      secondary: 2,
      low_priority: 3,
      insufficient_evidence: 4,
    };
    return (rank[left.recommendation] ?? 9) - (rank[right.recommendation] ?? 9);
  });
  return {
    kind: "ok",
    error: null,
    canWrite: canCreateOrEditOpportunities(organization.role),
    funnel,
    ranked,
    recentRejected: list.items.filter((item) => item.status === "rejected").slice(0, 5),
  };
}

export const getOpportunityBySlug = cache(async (slug: string): Promise<{
  item: OpportunityListItem | null;
  notes: string | null;
  rejectionReason: string | null;
  rejectionNote: string | null;
  assessments: Array<{
    dimension: string;
    result: string;
    explanation: string;
    sourceKind: string;
    completeness: string;
    assessedAt: string;
    evidence: Record<string, unknown>;
  }>;
  events: Array<{ id: string; title: string; detail: string | null; source: string; occurredAt: string }>;
  error: string | null;
  kind: "ok" | "not_found" | "error" | "no_organization";
}> => {
  const empty = {
    item: null as OpportunityListItem | null,
    notes: null as string | null,
    rejectionReason: null as string | null,
    rejectionNote: null as string | null,
    assessments: [] as Array<{
      dimension: string;
      result: string;
      explanation: string;
      sourceKind: string;
      completeness: string;
      assessedAt: string;
      evidence: Record<string, unknown>;
    }>,
    events: [] as Array<{ id: string; title: string; detail: string | null; source: string; occurredAt: string }>,
  };
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { ...empty, error: null, kind: "no_organization" };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("development_opportunities")
    .select(
      "id, slug, name, opportunity_type, status, country, region, municipality, target_mw, target_mwh, recommendation, recommendation_summary, key_positive, key_risk, data_confidence, latitude, longitude, updated_at, promoted_project_id, owner_id, notes, rejection_reason, rejection_note",
    )
    .eq("organization_id", organization.id)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("getOpportunityBySlug failed", error.message);
    return { ...empty, error: "Could not load opportunity.", kind: "error" };
  }
  if (!data) {
    return { ...empty, error: null, kind: "not_found" };
  }
  const row = data as OpportunityRow & {
    notes?: string | null;
    rejection_reason?: string | null;
    rejection_note?: string | null;
  };
  const [assessments, events, ownerResult, promotedResult] = await Promise.all([
    supabase
      .from("opportunity_assessments")
      .select("dimension, result, explanation, source_kind, completeness, assessed_at, evidence")
      .eq("organization_id", organization.id)
      .eq("opportunity_id", row.id)
      .order("dimension"),
    supabase
      .from("opportunity_events")
      .select("id, title, detail, source, occurred_at")
      .eq("organization_id", organization.id)
      .eq("opportunity_id", row.id)
      .order("occurred_at", { ascending: false })
      .limit(40),
    row.owner_id
      ? supabase.from("profiles").select("full_name").eq("id", row.owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.promoted_project_id
      ? supabase
          .from("projects")
          .select("slug")
          .eq("id", row.promoted_project_id)
          .eq("organization_id", organization.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    item: mapRow(row, {
      ownerName: ownerResult.data?.full_name?.trim() || null,
      promotedProjectSlug: promotedResult.data?.slug ?? null,
    }),
    notes: row.notes ?? null,
    rejectionReason: row.rejection_reason ?? null,
    rejectionNote: row.rejection_note ?? null,
    assessments: (assessments.data ?? []).map((item) => ({
      dimension: item.dimension,
      result: item.result,
      explanation: item.explanation,
      sourceKind: item.source_kind,
      completeness: item.completeness,
      assessedAt: item.assessed_at,
      evidence: (item.evidence ?? {}) as Record<string, unknown>,
    })),
    events: (events.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      source: item.source,
      occurredAt: item.occurred_at,
    })),
    error: null,
    kind: "ok",
  };
});
