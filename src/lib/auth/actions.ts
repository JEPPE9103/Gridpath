"use server";

import { authCallbackUrl } from "@/lib/auth/redirect";
import { getPostAuthPath } from "@/lib/auth/paths";
import {
  parseForgotPasswordForm,
  parseProfileForm,
  parseResetPasswordForm,
  parseSignupForm,
  parseWorkspaceName,
  publicAuthError,
} from "@/lib/auth/validation";
import { syncActiveOrganizationCookie } from "@/lib/organization/sync-active-org-cookie";
import {
  clearActiveOrganizationCookie,
  writeActiveOrganizationCookie,
} from "@/lib/organization/active-org-cookie";
import { slugifyProjectName } from "@/lib/projects/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const AUTH_ERROR = "Email or password is incorrect.";

export type ForgotPasswordState = {
  error?: string;
  fieldErrors?: ReturnType<typeof parseForgotPasswordForm>["fieldErrors"];
  email?: string;
  sent?: boolean;
};

export type ResetPasswordState = {
  error?: string;
  fieldErrors?: ReturnType<typeof parseResetPasswordForm>["fieldErrors"];
  success?: boolean;
};

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

  await syncActiveOrganizationCookie();
  revalidatePath("/", "layout");
  redirect(await getPostAuthPath());
}

export async function requestPasswordReset(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const { email, fieldErrors } = parseForgotPasswordForm(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, email };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl("/reset-password"),
  });

  if (error) {
    console.error("requestPasswordReset failed", error.message);
    return {
      error: publicAuthError(
        error.message,
        "Could not send a reset email. Try again.",
        "password_reset",
      ),
      email,
    };
  }

  return { sent: true, email };
}

export async function updatePasswordAfterRecovery(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const { password, fieldErrors, valid } = parseResetPasswordForm(formData);
  if (!valid) {
    return { fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "This reset link is invalid or has expired. Request a new reset email.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("updatePasswordAfterRecovery failed", error.message);
    return {
      error: publicAuthError(
        error.message,
        "Could not update your password. Try again.",
        "password_reset",
      ),
    };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?reset=success");
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

  const { data: organizationId, error: rpcError } = await supabase.rpc("create_workspace", {
    company_name: name,
    company_slug: workspaceSlugFromName(name),
    user_full_name: null,
    user_job_title: null,
  });

  if (rpcError || !organizationId) {
    console.error("createWorkspaceAction failed", rpcError?.message);
    return {
      error: publicAuthError(
        rpcError?.message,
        "Could not create the workspace. Try again.",
        "workspace",
      ),
      companyName: name,
    };
  }

  await writeActiveOrganizationCookie(String(organizationId));
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
  await clearActiveOrganizationCookie();
  revalidatePath("/", "layout");
  redirect("/login");
}
