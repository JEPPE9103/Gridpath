/**
 * Public site URL for metadata/canonical.
 * Prefer NEXT_PUBLIC_SITE_URL when the custom domain is live;
 * otherwise fall back to the current Vercel production alias.
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
  return "https://gridpath-henna.vercel.app";
}

/** Decorative host shown in marketing product frames only — not Auth Site URL. */
export const MARKETING_APP_HOST = "app.noxheim.com";
