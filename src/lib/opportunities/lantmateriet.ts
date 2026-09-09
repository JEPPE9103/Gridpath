/**
 * Lantmäteriet Markhöjdmodell (1 m DTM) via Geotorget / STAC.
 * Credentials are server-side only. Never commit secrets.
 */

export const LANTMATERIET_DTM_PROVIDER_KEY = "lantmateriet-dtm-1m";
export const LANTMATERIET_STAC_URL = "https://api.lantmateriet.se/stac-hojd/v1";

export const LANTMATERIET_PROVIDER_STATES = [
  "AUTH_REQUIRED",
  "AVAILABLE",
  "FAILED",
  "STALE",
  "FALLBACK_ACTIVE",
] as const;

export type LantmaterietProviderState = (typeof LANTMATERIET_PROVIDER_STATES)[number];

export function lantmaterietCredentialsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const user = env.LANTMATERIET_GEOTORGET_USERNAME?.trim();
  const password = env.LANTMATERIET_GEOTORGET_PASSWORD?.trim();
  const token = env.LANTMATERIET_STAC_TOKEN?.trim();
  return Boolean(token || (user && password));
}

export function resolveLantmaterietState(input: {
  credentialsConfigured: boolean;
  lastSuccessAt?: Date | null;
  lastAttemptStatus?: string | null;
  copernicusAvailable: boolean;
  now?: Date;
  staleAfterHours?: number;
}): LantmaterietProviderState {
  if (!input.credentialsConfigured) {
    return input.copernicusAvailable ? "FALLBACK_ACTIVE" : "AUTH_REQUIRED";
  }
  if (input.lastAttemptStatus === "failed") return "FAILED";
  const staleHours = input.staleAfterHours ?? 336;
  if (input.lastSuccessAt) {
    const now = input.now ?? new Date();
    if (now.getTime() - input.lastSuccessAt.getTime() > staleHours * 60 * 60 * 1000) {
      return "STALE";
    }
    return "AVAILABLE";
  }
  return input.copernicusAvailable ? "FALLBACK_ACTIVE" : "AUTH_REQUIRED";
}

export function lantmaterietStatusCopy(state: LantmaterietProviderState): string {
  switch (state) {
    case "AUTH_REQUIRED":
      return "Lantmäteriet detailed terrain provider not configured.";
    case "FALLBACK_ACTIVE":
      return "Lantmäteriet detailed terrain provider not configured. Discovery uses Copernicus GLO-90 (DSM, coarse).";
    case "FAILED":
      return "Lantmäteriet detailed terrain request failed. Copernicus GLO-90 remains the fallback where ingested.";
    case "STALE":
      return "Lantmäteriet detailed terrain is stale. Treat detailed slope as out of date until refreshed.";
    case "AVAILABLE":
      return "Lantmäteriet 1 m DTM is configured for candidate-scoped refinement.";
  }
}
