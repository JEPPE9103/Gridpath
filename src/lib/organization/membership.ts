import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function userHasAnyOrganizationMembership(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1);

  if (error) {
    console.error("userHasAnyOrganizationMembership failed", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}
