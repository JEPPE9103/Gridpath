import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** One Auth `getUser()` per RSC/server-action request. Does not replace proxy auth. */
export const getCachedAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
