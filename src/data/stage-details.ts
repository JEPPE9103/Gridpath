import type { ConnectionStage, PipelineStage, StageDetail } from "@/types";
import { CONNECTION_STAGES } from "@/types";

const REQUIREMENTS: Record<ConnectionStage, string[]> = {
  Screening: [
    "Site coordinates and land envelope",
    "Technology and capacity request",
    "Nearest substation / voltage hypothesis",
    "Internal screening memo",
  ],
  Enquiry: [
    "Formal connection enquiry form",
    "Preliminary single-line diagram",
    "Import/export profile",
    "Land control evidence",
  ],
  Application: [
    "Complete connection application pack",
    "Network Impact Assessment",
    "Landowner agreement",
    "Environmental permit status",
    "Technical appendix",
  ],
  "Grid Study": [
    "Signed grid study agreement",
    "Study data pack",
    "Study fee confirmation",
    "Operating scenario set",
  ],
  Offer: [
    "Connection offer review",
    "Commercial terms assessment",
    "Security / payment plan",
    "Internal investment recommendation",
  ],
  Agreement: [
    "Connection agreement",
    "Construction interface schedule",
    "Protection and control requirements",
    "Energisation prerequisites",
  ],
  Construction: [
    "Detailed electrical design",
    "Construction programme",
    "Grid works coordination",
    "Commissioning plan",
  ],
  Energisation: [
    "Commissioning tests",
    "Protection settings approved",
    "Operational notifications",
    "As-built documentation",
  ],
};

export const PIPELINE_TO_CONNECTION: Record<PipelineStage, ConnectionStage> = {
  Prospect: "Screening",
  Screened: "Screening",
  Enquiry: "Enquiry",
  Application: "Application",
  "Grid Study": "Grid Study",
  Offer: "Offer",
  Agreement: "Agreement",
  Construction: "Construction",
};

export function buildStageDetails(input: {
  current: ConnectionStage;
  owner: string;
  overrides?: Partial<Record<ConnectionStage, Partial<StageDetail>>>;
}): Record<ConnectionStage, StageDetail> {
  const currentIndex = CONNECTION_STAGES.indexOf(input.current);

  return Object.fromEntries(
    CONNECTION_STAGES.map((stage, index) => {
      const requirements = REQUIREMENTS[stage];
      const override = input.overrides?.[stage];
      const isPast = index < currentIndex;
      const isCurrent = index === currentIndex;

      const submitted =
        override?.submitted ??
        (isPast ? requirements : isCurrent ? requirements.slice(0, 2) : []);
      const missing =
        override?.missing ??
        (isPast ? [] : isCurrent ? requirements.slice(2) : requirements);

      const detail: StageDetail = {
        stage,
        requirements,
        submitted,
        missing,
        deadline: override?.deadline,
        owner: override?.owner ?? input.owner,
        notes:
          override?.notes ??
          (isPast
            ? "Stage complete. Records retained in the project file."
            : isCurrent
              ? "Current stage. Outstanding items are listed under missing information."
              : "Not started. Requirements become active when this stage opens."),
      };

      return [stage, detail];
    }),
  ) as Record<ConnectionStage, StageDetail>;
}
