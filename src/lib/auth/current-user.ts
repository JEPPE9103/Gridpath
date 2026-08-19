import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  initials: string;
};

function initialsFromName(fullName: string, email: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => part && !part.includes("@"));

  if (parts.length >= 2) {
    const first = parts[0]?.[0];
    const last = parts[parts.length - 1]?.[0];
    if (first && last) {
      return `${first}${last}`.toUpperCase();
    }
  }

  if (parts[0] && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const local = email.split("@")[0] || fullName;
  const letters = local.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  if (letters.length >= 2) {
    return letters.slice(0, 2).toUpperCase();
  }
  if (letters[0]) {
    return letters[0].toUpperCase();
  }
  return "?";
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const email = user.email?.trim() || "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, job_title")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    (typeof profile?.full_name === "string" && profile.full_name.trim()) || email || "Account";
  const jobTitle =
    typeof profile?.job_title === "string" && profile.job_title.trim()
      ? profile.job_title.trim()
      : null;

  return {
    id: user.id,
    email,
    fullName,
    jobTitle,
    initials: initialsFromName(fullName, email),
  };
}
