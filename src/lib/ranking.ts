import { outlookTone } from "@/lib/format";
import type { Project } from "@/types";

const OUTLOOK_SCORE: Record<Project["outlook"], number> = {
  Favourable: 40,
  Possible: 22,
  Unknown: 10,
  "Needs Attention": 8,
  "At Risk": 4,
  Weak: 2,
};

const CONFIDENCE_SCORE: Record<Project["confidence"], number> = {
  High: 15,
  Medium: 8,
  Low: 3,
  Unknown: 1,
};

const STAGE_SCORE: Record<Project["stage"], number> = {
  Prospect: 4,
  Screened: 8,
  Enquiry: 12,
  Application: 16,
  "Grid Study": 20,
  Offer: 26,
  Agreement: 32,
  Construction: 36,
};

export function developmentProfileScore(project: Project): number {
  return (
    OUTLOOK_SCORE[project.outlook] +
    CONFIDENCE_SCORE[project.confidence] +
    STAGE_SCORE[project.stage] +
    Math.round(project.applicationReadiness.percent * 0.25)
  );
}

export function rankProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => developmentProfileScore(b) - developmentProfileScore(a),
  );
}

export function strongestProfile(projects: Project[]): Project | undefined {
  return rankProjects(projects)[0];
}

export function rankingExplanation(): string {
  return "Ranked by outlook, stage progress, application readiness and data confidence. This is NOXHEIM analysis, not a grid operator decision and not a guarantee of capacity.";
}

export { outlookTone };
