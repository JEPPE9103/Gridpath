const OPENFREEMAP = "https://tiles.openfreemap.org";
const SUPABASE_HTTPS = "https://*.supabase.co";
const SUPABASE_WSS = "wss://*.supabase.co";
const ARCGIS = "https://services5.arcgis.com";

export function contentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${OPENFREEMAP} ${SUPABASE_HTTPS}`,
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE_HTTPS} ${SUPABASE_WSS} ${OPENFREEMAP} ${ARCGIS}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

export function securityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
}
