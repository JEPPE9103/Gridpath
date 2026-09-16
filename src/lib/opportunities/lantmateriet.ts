/**
 * Lantmäteriet Markhöjdmodell (1 m DTM) via Geotorget / STAC.
 * Credentials are server-side only. Never commit secrets.
 *
 * Auth preference (production):
 * 1. LANTMATERIET_STAC_TOKEN — pre-issued Bearer access token
 * 2. LANTMATERIET_CLIENT_ID + LANTMATERIET_CLIENT_SECRET — OAuth2 client credentials
 * 3. LANTMATERIET_GEOTORGET_USERNAME + LANTMATERIET_GEOTORGET_PASSWORD — Basic (systemkonto)
 */

export const LANTMATERIET_DTM_PROVIDER_KEY = "lantmateriet-dtm-1m";
export const LANTMATERIET_STAC_URL = "https://api.lantmateriet.se/stac-hojd/v1";
export const LANTMATERIET_OAUTH_TOKEN_URL = "https://apimanager.lantmateriet.se/oauth2/token";

export const LANTMATERIET_PROVIDER_STATES = [
  "AUTH_REQUIRED",
  "AVAILABLE",
  "FAILED",
  "STALE",
  "FALLBACK_ACTIVE",
] as const;

export type LantmaterietProviderState = (typeof LANTMATERIET_PROVIDER_STATES)[number];

export type LantmaterietAuthHeaders = { authorization: string };

type CachedToken = { authorization: string; expiresAtMs: number };

let oauthTokenCache: CachedToken | null = null;

export function lantmaterietCredentialsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const token = env.LANTMATERIET_STAC_TOKEN?.trim();
  const clientId = env.LANTMATERIET_CLIENT_ID?.trim();
  const clientSecret = env.LANTMATERIET_CLIENT_SECRET?.trim();
  const user = env.LANTMATERIET_GEOTORGET_USERNAME?.trim();
  const password = env.LANTMATERIET_GEOTORGET_PASSWORD?.trim();
  return Boolean(token || (clientId && clientSecret) || (user && password));
}

export function lantmaterietAuthMode(
  env: NodeJS.ProcessEnv = process.env,
): "bearer_token" | "oauth2_client_credentials" | "basic" | "none" {
  if (env.LANTMATERIET_STAC_TOKEN?.trim()) return "bearer_token";
  if (env.LANTMATERIET_CLIENT_ID?.trim() && env.LANTMATERIET_CLIENT_SECRET?.trim()) {
    return "oauth2_client_credentials";
  }
  if (env.LANTMATERIET_GEOTORGET_USERNAME?.trim() && env.LANTMATERIET_GEOTORGET_PASSWORD?.trim()) {
    return "basic";
  }
  return "none";
}

async function fetchOAuth2AccessToken(env: NodeJS.ProcessEnv): Promise<LantmaterietAuthHeaders> {
  const clientId = env.LANTMATERIET_CLIENT_ID?.trim();
  const clientSecret = env.LANTMATERIET_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Lantmäteriet OAuth2 client credentials are not configured");
  }
  const now = Date.now();
  if (oauthTokenCache && oauthTokenCache.expiresAtMs > now + 30_000) {
    return { authorization: oauthTokenCache.authorization };
  }
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const response = await fetch(LANTMATERIET_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      "user-agent": "NOXHEIM/1.0 (+https://www.noxheim.com; lantmateriet-oauth)",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Lantmäteriet OAuth2 token HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; token_type?: string };
  const accessToken = payload.access_token?.trim();
  if (!accessToken) {
    throw new Error("Lantmäteriet OAuth2 response missing access_token");
  }
  const expiresInSec = Number.isFinite(payload.expires_in) ? Number(payload.expires_in) : 3600;
  const authorization = `Bearer ${accessToken}`;
  oauthTokenCache = {
    authorization,
    expiresAtMs: now + Math.max(60, expiresInSec - 60) * 1000,
  };
  return { authorization };
}

/** Resolve server-side Authorization header. Never log the value. */
export async function resolveLantmaterietAuthHeaders(
  env: NodeJS.ProcessEnv = process.env,
): Promise<LantmaterietAuthHeaders | null> {
  const token = env.LANTMATERIET_STAC_TOKEN?.trim();
  if (token) return { authorization: `Bearer ${token}` };
  if (env.LANTMATERIET_CLIENT_ID?.trim() && env.LANTMATERIET_CLIENT_SECRET?.trim()) {
    return fetchOAuth2AccessToken(env);
  }
  const user = env.LANTMATERIET_GEOTORGET_USERNAME?.trim();
  const password = env.LANTMATERIET_GEOTORGET_PASSWORD?.trim();
  if (user && password) {
    return { authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` };
  }
  return null;
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
