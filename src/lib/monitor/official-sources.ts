import {
  OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG,
  OFFICIAL_EI_NUP_SOURCE_SLUG,
} from "@/lib/domain/grid-intelligence";

export const MONITOR_OFFICIAL_SOURCE_SLUGS = [
  OFFICIAL_EI_NUP_SOURCE_SLUG,
  OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG,
] as const;

export type MonitorOfficialSourceSlug = (typeof MONITOR_OFFICIAL_SOURCE_SLUGS)[number];

export const OFFICIAL_EI_NUP_LANDING_URLS = [
  "https://ei.se/bransch/natutvecklingsplaner/karttjanst-natutvecklingsplaner",
  "https://ei.se/om-oss/statistik-och-oppna-data/natutvecklingsplaner---elnat",
] as const;

export const OFFICIAL_SOURCE_LANDING_URLS: Record<MonitorOfficialSourceSlug, string> = {
  [OFFICIAL_EI_NUP_SOURCE_SLUG]: OFFICIAL_EI_NUP_LANDING_URLS[0],
  [OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG]:
    "https://ei.se/bransch/koncessioner/ansokan-natkoncession-for-omrade",
};

export const DEFAULT_REFRESH_INTERVAL_HOURS = 168;

export const MONITOR_USER_AGENT = "NOXHEIM-monitor/1.0 (official public source probe)";

export function isMonitorOfficialSourceSlug(value: string): value is MonitorOfficialSourceSlug {
  return (MONITOR_OFFICIAL_SOURCE_SLUGS as readonly string[]).includes(value);
}

export function isAllowedOfficialFetchUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return host === "ei.se" || host.endsWith(".ei.se");
}
