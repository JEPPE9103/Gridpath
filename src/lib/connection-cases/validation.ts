import {
  CONNECTION_CASE_STATUS_VALUES,
  PROJECT_STAGE_VALUES,
  connectionCaseStatusToDb,
  pipelineStageToDb,
} from "@/lib/domain/catalog-labels";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ConnectionCaseFormInput = {
  gridOperatorId: string;
  stage: string;
  status: string;
  caseId: string;
  submittedAt: string;
  nextMilestone: string;
  deadline: string;
  notes: string;
};

export type ConnectionCaseFieldErrors = Partial<
  Record<"stage" | "status" | "gridOperatorId" | "submittedAt" | "deadline" | "caseId", string>
>;

export type ParsedConnectionCase = {
  gridOperatorId: string | null;
  stage: (typeof PROJECT_STAGE_VALUES)[number];
  status: (typeof CONNECTION_CASE_STATUS_VALUES)[number];
  caseId: string | null;
  submittedAt: string | null;
  nextMilestone: string | null;
  deadline: string | null;
  notes: string | null;
};

function optionalDate(value: string): string | null | "invalid" {
  if (!value) {
    return null;
  }
  if (!DATE_PATTERN.test(value)) {
    return "invalid";
  }
  return value;
}

export function parseConnectionCaseForm(formData: FormData): {
  values: ConnectionCaseFormInput;
  parsed: ParsedConnectionCase | null;
  fieldErrors: ConnectionCaseFieldErrors;
} {
  const gridOperatorId = String(formData.get("gridOperatorId") ?? "").trim();
  const stageRaw = String(formData.get("stage") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const caseId = String(formData.get("caseId") ?? "").trim();
  const submittedAt = String(formData.get("submittedAt") ?? "").trim();
  const nextMilestone = String(formData.get("nextMilestone") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const values: ConnectionCaseFormInput = {
    gridOperatorId,
    stage: stageRaw,
    status: statusRaw,
    caseId,
    submittedAt,
    nextMilestone,
    deadline,
    notes,
  };

  const fieldErrors: ConnectionCaseFieldErrors = {};
  const stage = pipelineStageToDb(stageRaw);
  if (!stage) {
    fieldErrors.stage = "Select a connection stage.";
  }

  const status = connectionCaseStatusToDb(statusRaw) ??
    (CONNECTION_CASE_STATUS_VALUES.includes(
      statusRaw as (typeof CONNECTION_CASE_STATUS_VALUES)[number],
    )
      ? (statusRaw as (typeof CONNECTION_CASE_STATUS_VALUES)[number])
      : null);
  if (!status) {
    fieldErrors.status = "Select a case status.";
  }

  if (gridOperatorId && !UUID_PATTERN.test(gridOperatorId)) {
    fieldErrors.gridOperatorId = "Select a valid grid operator.";
  }

  if (caseId.length > 120) {
    fieldErrors.caseId = "Case reference is too long.";
  }

  const submitted = optionalDate(submittedAt);
  if (submitted === "invalid") {
    fieldErrors.submittedAt = "Use a valid date.";
  }

  const due = optionalDate(deadline);
  if (due === "invalid") {
    fieldErrors.deadline = "Use a valid date.";
  }

  if (Object.keys(fieldErrors).length > 0 || !stage || !status) {
    return { values, parsed: null, fieldErrors };
  }

  return {
    values,
    parsed: {
      gridOperatorId: gridOperatorId || null,
      stage,
      status,
      caseId: caseId || null,
      submittedAt: submitted === "invalid" ? null : submitted,
      nextMilestone: nextMilestone || null,
      deadline: due === "invalid" ? null : due,
      notes: notes || null,
    },
    fieldErrors,
  };
}
