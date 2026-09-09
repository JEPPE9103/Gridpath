import { cache } from "react";
import { getCurrentOrganization } from "@/lib/data/organization";
import {
  parseScreeningProfileCriteria,
  type ScreeningProfileRecord,
} from "@/lib/opportunities/screening-profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getOpportunityScreeningProfiles = cache(async (): Promise<ScreeningProfileRecord[]> => {
  const organization = await getCurrentOrganization();
  if (!organization) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunity_screening_profiles")
    .select("id, name, origin, technology, criteria")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    origin: row.origin === "noxheim_default" ? "noxheim_default" : "customer",
    criteria: {
      ...parseScreeningProfileCriteria(row.criteria),
      technology: row.technology as ScreeningProfileRecord["criteria"]["technology"],
    },
  }));
});
