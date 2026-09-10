const FORBIDDEN_TERMS = [
  "available grid capacity",
  "available mw",
  "connectable mw",
  "guaranteed connection",
  "good connection potential",
  "high connection chance",
  "probability of connection",
  "will receive connection",
  "best place to build",
  "perfect site",
  "build here",
  "87% chance",
  "ai says",
  "guaranteed site",
  "grid connection likely",
  "permitting will succeed",
  "noxheim capacity estimate",
  "high probability of connection",
  "connection likelihood",
  "available connection point",
  "connectable capacity",
] as const;

export function publicOpportunityError(message: string | undefined, fallback: string): string {
  const raw = (message ?? "").trim();
  const text = raw.toLowerCase();
  if (!raw) return fallback;
  if (
    /postgres|plpgsql|sqlstate|permission denied for|relation |column |rpc |stack trace|exception/i.test(
      raw,
    )
  ) {
    return fallback;
  }
  if (text.includes("not authenticated") || text.includes("no organization")) {
    return "Sign in to manage opportunities.";
  }
  if (text.includes("not allowed") || text.includes("permission") || text.includes("42501")) {
    return "You do not have permission to do that.";
  }
  if (text.includes("already promoted")) {
    return "This opportunity has already been promoted.";
  }
  if (text.includes("coordinates required")) {
    return "Add coordinates before promoting to a project.";
  }
  if (text.includes("rejected")) {
    return "Reopen a rejected opportunity before promoting it.";
  }
  if (
    text.includes("bounding box") ||
    text.includes("15000") ||
    text.includes("swedish envelope") ||
    text.includes("west must") ||
    text.includes("south must")
  ) {
    return raw;
  }
  return fallback;
}

export function opportunityCopyContainsForbiddenTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}
