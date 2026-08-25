"use server";

import { getPostAuthPath } from "@/lib/auth/paths";
import {
  parseProfileForm,
  parseSignupForm,
  parseWorkspaceName,
  publicAuthError,
} from "@/lib/auth/validation";
import { slugifyProjectName } from "@/lib/projects/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const AUTH_ERROR = "Email or password is incorrect.";

export type SignupState = {
  error?: string;
  fieldErrors?: ReturnType<typeof parseSignupForm>["fieldErrors"];
  values?: ReturnType<typeof parseSignupForm>["values"];
  needsConfirmation?: boolean;
};

export type WorkspaceState = {
  error?: string;
  companyName?: string;
};

export type ProfileState = {
  error?: string;
  saved?: boolean;
};

function workspaceSlugFromName(name: string): string {
  const slug = slugifyProjectName(name);
  return slug === "project" ? "workspace" : slug;
}

export async function signIn(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return AUTH_ERROR;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return AUTH_ERROR;
  }

  revalidatePath("/", "layout");
  redirect(await getPostAuthPath());
}

export async function signUp(
  _previous: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const { values, parsed, fieldErrors } = parseSignupForm(formData);
  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: {
        full_name: parsed.fullName,
        job_title: parsed.jobTitle ?? "",
      },
    },
  });

  if (error) {
    console.error("signUp failed", error.message);
    return {
      error: publicAuthError(error.message, "Could not create the account. Try again.", "signup"),
      values,
    };
  }

  if (!data.session) {
    return {
      needsConfirmation: true,
      values: { fullName: parsed.fullName, email: parsed.email, jobTitle: parsed.jobTitle ?? "" },
    };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function createWorkspaceAction(
  _previous: WorkspaceState,
  formData: FormData,
): Promise<WorkspaceState> {
  const { name, error } = parseWorkspaceName(formData);
  if (error) {
    return { error, companyName: name };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in to create a workspace.", companyName: name };
  }

  const { error: rpcError } = await supabase.rpc("create_workspace", {
    company_name: name,
    company_slug: workspaceSlugFromName(name),
    user_full_name: null,
    user_job_title: null,
  });

  if (rpcError) {
    console.error("createWorkspaceAction failed", rpcError.message);
    return {
      error: publicAuthError(rpcError.message, "Could not create the workspace. Try again.", "workspace"),
      companyName: name,
    };
  }

  revalidatePath("/", "layout");
  redirect("/portfolio");
}

export async function updateProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = parseProfileForm(formData);
  if (parsed.error) {
    return { error: parsed.error };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in to update your profile." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.fullName,
      job_title: parsed.jobTitle || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfileAction failed", error.message);
    return { error: "Could not update your profile." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { saved: true };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
