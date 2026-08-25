const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export type SignupFormInput = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  jobTitle: string;
};

export type SignupFieldErrors = Partial<Record<"fullName" | "email" | "password" | "confirmPassword", string>>;

export function parseSignupForm(formData: FormData): {
  values: Omit<SignupFormInput, "password" | "confirmPassword">;
  parsed: { fullName: string; email: string; password: string; jobTitle: string | null } | null;
  fieldErrors: SignupFieldErrors;
} {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();

  const values = { fullName, email, jobTitle };
  const fieldErrors: SignupFieldErrors = {};

  if (!fullName) {
    fieldErrors.fullName = "Enter your full name.";
  } else if (fullName.length > 120) {
    fieldErrors.fullName = "Name is too long.";
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid work email.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { values, parsed: null, fieldErrors };
  }

  return {
    values,
    parsed: {
      fullName,
      email,
      password,
      jobTitle: jobTitle || null,
    },
    fieldErrors,
  };
}

export function parseWorkspaceName(formData: FormData): {
  name: string;
  error?: string;
} {
  const name = String(formData.get("companyName") ?? "").trim();
  if (!name) {
    return { name, error: "Enter a company name." };
  }
  if (name.length > 120) {
    return { name, error: "Company name is too long." };
  }
  return { name };
}

export function parseProfileForm(formData: FormData): {
  fullName: string;
  jobTitle: string;
  error?: string;
} {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  if (!fullName) {
    return { fullName, jobTitle, error: "Enter your full name." };
  }
  if (fullName.length > 120) {
    return { fullName, jobTitle, error: "Name is too long." };
  }
  return { fullName, jobTitle };
}

export function publicAuthError(
  message: string | undefined,
  fallback: string,
  kind: "signup" | "workspace" | "generic" = "generic",
): string {
  const text = (message ?? "").toLowerCase();
  if (
    text.includes("rate") ||
    text.includes("too many") ||
    text.includes("over_email") ||
    text.includes("email rate")
  ) {
    return kind === "signup"
      ? "Too many signup attempts. Please wait before trying again."
      : "Too many attempts. Please wait before trying again.";
  }
  if (kind === "signup") {
    if (
      text.includes("already registered") ||
      text.includes("already exists") ||
      text.includes("user already")
    ) {
      return "An account with this email already exists.";
    }
    if (
      text.includes("invalid email") ||
      text.includes("unable to validate email") ||
      (text.includes("email address") && text.includes("invalid"))
    ) {
      return "Enter a valid work email.";
    }
    if (
      text.includes("password") &&
      (text.includes("weak") || text.includes("least") || text.includes("short") || text.includes("characters"))
    ) {
      return "Choose a stronger password.";
    }
  }
  if (text.includes("not authenticated") || text.includes("session")) {
    return "Sign in to continue.";
  }
  if (kind === "workspace" && text.includes("company name is required")) {
    return "Enter a company name.";
  }
  return fallback;
}
