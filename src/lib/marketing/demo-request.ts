export interface DemoRequest {
  name: string;
  company: string;
  email: string;
  message: string;
}

export function validateDemoRequest(
  input: DemoRequest,
): Partial<Record<keyof DemoRequest, string>> {
  const errors: Partial<Record<keyof DemoRequest, string>> = {};

  if (!input.name.trim()) errors.name = "Enter your name.";
  if (!input.company.trim()) errors.company = "Enter your company.";

  const email = input.email.trim();
  if (!email) {
    errors.email = "Enter a work email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (input.message.length > 2000) {
    errors.message = "Message is too long.";
  }

  return errors;
}
