/**
 * Public site URL for metadata/canonical.
 * Prefer NEXT_PUBLIC_SITE_URL when set; otherwise Vercel production host;
 * otherwise the primary custom domain.
 */
export function getPublicSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }
  return "https://www.noxheim.com";
}

/** Decorative host shown in marketing product frames only — not Auth Site URL. */
export const MARKETING_APP_HOST = "www.noxheim.com";
