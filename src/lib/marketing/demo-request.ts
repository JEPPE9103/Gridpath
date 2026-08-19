export interface DemoRequest {
  name: string;
  company: string;
  email: string;
  role: string;
}

export const DEMO_ROLES = [
  "Portfolio Manager",
  "Development Manager",
  "Grid Engineer",
  "Consultant",
  "Founder / Executive",
  "Other",
] as const;

export function validateDemoRequest(
  input: DemoRequest,
): Partial<Record<keyof DemoRequest, string>> {
  const errors: Partial<Record<keyof DemoRequest, string>> = {};

  if (!input.name.trim()) errors.name = "Enter your name.";
  if (!input.company.trim()) errors.company = "Enter your company.";
  if (!input.role.trim()) errors.role = "Select a role.";

  const email = input.email.trim();
  if (!email) {
    errors.email = "Enter a work email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

/** Replace this with a CRM or API call. Currently a client-side placeholder. */
export async function submitDemoRequest(request: DemoRequest): Promise<void> {
  void request;
  await new Promise((resolve) => setTimeout(resolve, 400));
}
