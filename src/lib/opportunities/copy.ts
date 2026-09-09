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
] as const;

export function opportunityCopyContainsForbiddenTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}
