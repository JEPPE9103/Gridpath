const FORBIDDEN_TERMS = [
  "available grid capacity",
  "available mw",
  "connectable mw",
  "guaranteed connection",
  "probability of connection",
  "will receive connection",
  "best place to build",
  "perfect site",
  "build here",
  "87% chance",
  "ai says",
  "chance of success",
] as const;

export function opportunityCopyContainsForbiddenTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}
