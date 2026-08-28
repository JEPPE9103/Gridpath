"use server";

import {
  validateDemoRequest,
  type DemoRequest,
} from "@/lib/marketing/demo-request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DemoRequestState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof DemoRequest, string>>;
  values?: DemoRequest;
};

export async function submitDemoRequestAction(
  _previous: DemoRequestState,
  formData: FormData,
): Promise<DemoRequestState> {
  const values: DemoRequest = {
    name: String(formData.get("name") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    message: String(formData.get("message") ?? "").trim(),
  };

  const fieldErrors = validateDemoRequest(values);
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("demo_requests").insert({
    name: values.name,
    company: values.company,
    email: values.email,
    message: values.message || null,
  });

  if (error) {
    console.error("submitDemoRequestAction failed", error.message);
    return {
      error: "Could not send your request. Please try again or email us directly.",
      values,
    };
  }

  return { ok: true };
}
