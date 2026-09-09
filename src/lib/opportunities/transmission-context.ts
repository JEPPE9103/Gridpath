/**
 * Official Indicative Transmission Context (Svenska kraftnät).
 *
 * NOXHEIM does not estimate available grid capacity.
 * It may display capacity information explicitly published by an official source,
 * with that source's geographic and methodological limitations preserved.
 *
 * Production status (2026-09): the SvK 2026 transmission capacity map is an
 * interactive application (karta.svk.se). TSO-DSO Capacitypedia records
 * "Availability of API: Not provided". SvK Data Service (data.svk.se) does not
 * publish this county-level dataset. HTML scraping is forbidden.
 */

export const SVK_CAPACITY_PROVIDER_KEY = "svk-indicative-transmission-2026";

export const SVK_CAPACITY_STATUS = "blocked_no_structured_source" as const;

export const SVK_CAPACITY_LIMITATION =
  "This is an aggregated county-level indication for the transmission network and does not indicate available capacity at this candidate site or in the underlying regional/local network.";

export const SVK_QUEUE_LIMITATION =
  "Applied, reserved and allocated figures are published at the same aggregated geography. NOXHEIM does not subtract them to invent remaining capacity. Svenska kraftnät warns against doing so.";

export const GRID_CONTEXT_HIERARCHY = {
  localDistribution: "LOCAL/DISTRIBUTION CONTEXT",
  transmission: "TRANSMISSION CONTEXT",
  projectConnection: "PROJECT-SPECIFIC CONNECTION",
} as const;

export type OfficialTransmissionContext = {
  queried: boolean;
  available: boolean;
  providerKey: typeof SVK_CAPACITY_PROVIDER_KEY;
  status: typeof SVK_CAPACITY_STATUS | "available";
  geographyLevel: "county";
  countyName: string | null;
  countyCode: string | null;
  year: 2026;
  direction: "consumption" | "generation" | null;
  indicativeBandMw: string | null;
  appliedMw: number | null;
  reservedMw: number | null;
  allocatedMw: number | null;
  publishedAt: string | null;
  sourceName: "Svenska kraftnät";
  limitation: typeof SVK_CAPACITY_LIMITATION;
};

export function emptyOfficialTransmissionContext(
  countyName: string | null = null,
): OfficialTransmissionContext {
  return {
    queried: true,
    available: false,
    providerKey: SVK_CAPACITY_PROVIDER_KEY,
    status: SVK_CAPACITY_STATUS,
    geographyLevel: "county",
    countyName,
    countyCode: null,
    year: 2026,
    direction: null,
    indicativeBandMw: null,
    appliedMw: null,
    reservedMw: null,
    allocatedMw: null,
    publishedAt: null,
    sourceName: "Svenska kraftnät",
    limitation: SVK_CAPACITY_LIMITATION,
  };
}

export function officialTransmissionCopy(context: OfficialTransmissionContext): string {
  if (!context.available) {
    return `Official Indicative Transmission Context is unavailable. Svenska kraftnät publishes a 2026 county-level capacity map, but no production-safe structured source (API or documented download) is integrated. ${SVK_CAPACITY_LIMITATION} NOXHEIM does not estimate project-level grid capacity.`;
  }
  const place = context.countyName ? ` — ${context.countyName} County` : "";
  return `Official SvK indication${place}. Indicative transmission capacity, ${context.year}: ${context.indicativeBandMw ?? "not published in this record"}. Source: Svenska kraftnät${context.publishedAt ? `. Published/updated: ${context.publishedAt}` : ""}. ${context.limitation}`;
}

export function highApplicationVolumeCopy(context: OfficialTransmissionContext): string | null {
  if (!context.available || context.appliedMw == null) return null;
  return `High application volume exists at the published county level (${context.appliedMw} MW applied). ${SVK_QUEUE_LIMITATION}`;
}

/** County-level official indication must never outrank site evidence. */
export function strategicTransmissionScore(context: OfficialTransmissionContext | null | undefined): number {
  if (!context?.available) return 0;
  return 0;
}

export function projectConnectionCopy(): string {
  return "UNKNOWN unless supplied by the customer or official case-specific evidence. Covering geography and county transmission indications are not a connection point.";
}

export function transmissionContextFromRecord(
  value: Record<string, unknown> | null | undefined,
  countyName: string | null = null,
): OfficialTransmissionContext {
  if (!value || Object.keys(value).length === 0) {
    return emptyOfficialTransmissionContext(countyName);
  }
  const available = value.available === true;
  return {
    ...emptyOfficialTransmissionContext(
      typeof value.countyName === "string" ? value.countyName : countyName,
    ),
    queried: value.queried !== false,
    available,
    status: available ? "available" : SVK_CAPACITY_STATUS,
    countyCode: typeof value.countyCode === "string" ? value.countyCode : null,
    indicativeBandMw: typeof value.indicativeBandMw === "string" ? value.indicativeBandMw : null,
    appliedMw: typeof value.appliedMw === "number" ? value.appliedMw : null,
    reservedMw: typeof value.reservedMw === "number" ? value.reservedMw : null,
    allocatedMw: typeof value.allocatedMw === "number" ? value.allocatedMw : null,
    publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : null,
  };
}
