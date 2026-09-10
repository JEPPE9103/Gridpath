/**
 * Coarse product-stage progress for a blocking geographic screening action.
 *
 * Stages are elapsed-time estimates of known engine steps (discovery → site
 * generation → ranking). They must never be presented as provider ingest
 * completion, and they must never invent a numeric percentage.
 */

export const SCREENING_PROGRESS_HEADING = "Analysing search area";

export const SCREENING_PROGRESS_WAIT_COPY =
  "A municipal-scale screening can take 10–30 seconds. You can safely wait on this page.";

export const SCREENING_PROGRESS_NAVIGATE_COPY =
  "Leaving this page does not cancel the screening. Return to Opportunities if you navigate away.";

export const REFINE_PROGRESS_HEADING = "Refining selected candidate";

export const REFINE_PROGRESS_WAIT_COPY =
  "Detailed screening uses higher-resolution land-cover and terrain evidence on the selected Candidate Site. This typically takes under two seconds.";

export const SCREENING_PROGRESS_STAGES = [
  {
    id: "geography",
    title: "Preparing geography",
    detail: "Clipping the search area to Sweden and preparing analysis cells.",
    startsAtMs: 0,
  },
  {
    id: "environment",
    title: "Applying environmental constraints",
    detail: "Analysing official environmental constraints where those layers are ingested.",
    startsAtMs: 400,
  },
  {
    id: "land",
    title: "Analysing land cover",
    detail: "Evaluating land-cover evidence and finding contiguous usable areas.",
    startsAtMs: 900,
  },
  {
    id: "sites",
    title: "Generating candidate sites",
    detail: "Growing site-scale investigation targets inside opportunity zones.",
    startsAtMs: 1500,
  },
  {
    id: "ranking",
    title: "Ranking opportunities",
    detail: "Ranking candidates against your screening profile.",
    startsAtMs: 14_500,
  },
] as const;

export const REFINE_PROGRESS_STAGES = [
  {
    id: "land",
    title: "Applying land-cover evidence",
    detail: "Re-evaluating the selected footprint with higher-resolution land cover where ingested.",
    startsAtMs: 0,
  },
  {
    id: "terrain",
    title: "Applying terrain evidence",
    detail: "Updating slope evidence where a detailed terrain source is available.",
    startsAtMs: 400,
  },
  {
    id: "rank",
    title: "Updating rank",
    detail: "Refreshing investigation priority from the refined evidence.",
    startsAtMs: 900,
  },
] as const;

export type ScreeningProgressStageId = (typeof SCREENING_PROGRESS_STAGES)[number]["id"];
export type ScreeningProgressStatus = "complete" | "active" | "pending";

export type ScreeningProgressStageView = {
  id: string;
  title: string;
  detail: string;
  status: ScreeningProgressStatus;
};

export type ScreeningProgressView = {
  heading: string;
  waitCopy: string;
  navigateCopy: string | null;
  stages: ScreeningProgressStageView[];
  activeId: string;
};

function stagesForElapsed(
  stages: ReadonlyArray<{ id: string; title: string; detail: string; startsAtMs: number }>,
  elapsedMs: number,
): ScreeningProgressStageView[] {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return stages.map((stage, index) => {
    const next = stages[index + 1];
    let status: ScreeningProgressStatus = "pending";
    if (safeElapsed >= stage.startsAtMs) {
      status = next && safeElapsed >= next.startsAtMs ? "complete" : "active";
    }
    return {
      id: stage.id,
      title: stage.title,
      detail: stage.detail,
      status,
    };
  });
}

export function screeningProgressForElapsed(elapsedMs: number): ScreeningProgressView {
  const stages = stagesForElapsed(SCREENING_PROGRESS_STAGES, elapsedMs);
  const active = stages.find((stage) => stage.status === "active") ?? stages[stages.length - 1];
  return {
    heading: SCREENING_PROGRESS_HEADING,
    waitCopy: SCREENING_PROGRESS_WAIT_COPY,
    navigateCopy: SCREENING_PROGRESS_NAVIGATE_COPY,
    stages,
    activeId: active.id,
  };
}

export function refineProgressForElapsed(elapsedMs: number): ScreeningProgressView {
  const stages = stagesForElapsed(REFINE_PROGRESS_STAGES, elapsedMs);
  const active = stages.find((stage) => stage.status === "active") ?? stages[stages.length - 1];
  return {
    heading: REFINE_PROGRESS_HEADING,
    waitCopy: REFINE_PROGRESS_WAIT_COPY,
    navigateCopy: null,
    stages,
    activeId: active.id,
  };
}

export function screeningProgressContainsFakePercent(text: string): boolean {
  return /\b\d{1,3}\s?%/.test(text);
}
