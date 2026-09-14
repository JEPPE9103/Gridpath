/**
 * Real discovery ingest/screening stages. Status comes from the server
 * orchestrator. Elapsed-time fallbacks exist only when the poll has not
 * arrived yet. Never invent a percentage.
 */

export const DISCOVERY_PROGRESS_HEADING = "Preparing Swedish geography";

export const DISCOVERY_PROGRESS_WAIT_COPY =
  "The first search in a new area may load official land cover, terrain and road geography. A repeat search over the same area reuses the cache.";

export const DISCOVERY_PROGRESS_NAVIGATE_COPY =
  "Leaving this page does not cancel the screening. Return to Opportunities if you navigate away.";

export const DISCOVERY_PROGRESS_STAGES = [
  {
    id: "preparing",
    title: "Preparing area",
    detail: "Clipping the Search Area to Sweden.",
  },
  {
    id: "checking",
    title: "Checking official evidence",
    detail: "Seeing which official layers already cover this geography.",
  },
  {
    id: "land_cover",
    title: "Loading land cover",
    detail: "Fetching missing NMD 2023 summaries for this Search Area, or reusing cache.",
  },
  {
    id: "terrain",
    title: "Loading terrain",
    detail: "Fetching missing Copernicus GLO-90 slope summaries, or reusing cache.",
  },
  {
    id: "roads",
    title: "Loading road geography",
    detail: "Fetching missing Trafikverket RoadLink for this bbox, or reusing cache.",
  },
  {
    id: "screening",
    title: "Running screening",
    detail: "Applying the existing site-generation engine to official evidence.",
  },
  {
    id: "candidates",
    title: "Generating Candidate Sites",
    detail: "Growing and ranking Candidate Sites inside the Search Area.",
  },
] as const;

export type DiscoveryProgressStageId = (typeof DISCOVERY_PROGRESS_STAGES)[number]["id"];

export type DiscoverySourceRun = {
  slug: string;
  action: "fetched" | "cache" | "skipped" | "failed" | "waiting";
  detail?: string;
};

export type DiscoveryIngestProgress = {
  stage: DiscoveryProgressStageId;
  messages: string[];
  sources: DiscoverySourceRun[];
  updatedAt: string;
};

export const FALLBACK_STAGE_STARTS_MS: Record<DiscoveryProgressStageId, number> = {
  preparing: 0,
  checking: 400,
  land_cover: 900,
  terrain: 2_000,
  roads: 4_000,
  screening: 8_000,
  candidates: 16_000,
};

export function discoveryProgressFromStage(
  stage: DiscoveryProgressStageId,
  messages: string[] = [],
): {
  heading: string;
  waitCopy: string;
  navigateCopy: string;
  activeId: DiscoveryProgressStageId;
  messages: string[];
  stages: Array<{
    id: DiscoveryProgressStageId;
    title: string;
    detail: string;
    status: "complete" | "active" | "pending";
  }>;
} {
  const activeIndex = DISCOVERY_PROGRESS_STAGES.findIndex((item) => item.id === stage);
  const index = activeIndex < 0 ? 0 : activeIndex;
  return {
    heading: DISCOVERY_PROGRESS_HEADING,
    waitCopy: DISCOVERY_PROGRESS_WAIT_COPY,
    navigateCopy: DISCOVERY_PROGRESS_NAVIGATE_COPY,
    activeId: DISCOVERY_PROGRESS_STAGES[index]?.id ?? "preparing",
    messages,
    stages: DISCOVERY_PROGRESS_STAGES.map((item, itemIndex) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      status: itemIndex < index ? "complete" : itemIndex === index ? "active" : "pending",
    })),
  };
}

export function discoveryProgressForElapsed(elapsedMs: number) {
  const safe = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  let stage: DiscoveryProgressStageId = "preparing";
  for (const item of DISCOVERY_PROGRESS_STAGES) {
    if (safe >= FALLBACK_STAGE_STARTS_MS[item.id]) stage = item.id;
  }
  return discoveryProgressFromStage(stage);
}

export function parseDiscoveryIngestProgress(value: unknown): DiscoveryIngestProgress | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const stage = DISCOVERY_PROGRESS_STAGES.some((item) => item.id === row.stage)
    ? (row.stage as DiscoveryProgressStageId)
    : null;
  if (!stage) return null;
  return {
    stage,
    messages: Array.isArray(row.messages) ? row.messages.map((item) => String(item)).slice(0, 12) : [],
    sources: Array.isArray(row.sources)
      ? row.sources.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const source = item as Record<string, unknown>;
          const action =
            source.action === "fetched" ||
            source.action === "cache" ||
            source.action === "skipped" ||
            source.action === "failed" ||
            source.action === "waiting"
              ? source.action
              : null;
          const slug = String(source.slug ?? "");
          if (!action || !slug) return [];
          return [
            {
              slug,
              action,
              detail: typeof source.detail === "string" ? source.detail : undefined,
            },
          ];
        })
      : [],
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
  };
}
