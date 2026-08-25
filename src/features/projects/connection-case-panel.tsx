"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import {
  createConnectionCaseAction,
  deleteConnectionCaseAction,
  updateConnectionCaseAction,
  type ConnectionCaseMutationState,
} from "@/lib/connection-cases/actions";
import type { GridOperatorOption } from "@/lib/data/grid-operators";
import type { ProjectConnectionCase, ProjectDetailViewModel } from "@/lib/data/project-detail-types";
import {
  CONNECTION_CASE_STATUS_VALUES,
  PROJECT_STAGE_VALUES,
  connectionCaseStatusLabel,
  pipelineStageLabel,
} from "@/lib/domain/catalog-labels";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type ReactNode } from "react";

const INITIAL: ConnectionCaseMutationState = {};

const inputClass =
  "mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink";

export function ConnectionCasePanel({
  project,
  operators,
  initialMode = "view",
}: {
  project: ProjectDetailViewModel;
  operators: GridOperatorOption[];
  initialMode?: "view" | "create" | "edit";
}) {
  const connectionCase = project.connectionCase;
  const [mode, setMode] = useState<"view" | "create" | "edit">(
    initialMode === "create" && !connectionCase
      ? "create"
      : initialMode === "edit" && connectionCase
        ? "edit"
        : "view",
  );

  if (mode === "create" && project.canManageConnectionCase) {
    return (
      <ConnectionCaseForm
        action={createConnectionCaseAction}
        project={project}
        operators={operators}
        submitLabel="Start connection process"
        onCancel={() => setMode("view")}
        defaults={{
          gridOperatorId: project.gridOperatorId ?? "",
          stage: project.stage
            ? PROJECT_STAGE_VALUES.find((value) => pipelineStageLabel(value) === project.stage) ??
              "prospect"
            : "prospect",
          status: "on_track",
          caseId: "",
          submittedAt: "",
          nextMilestone: "",
          deadline: "",
          notes: "",
        }}
      />
    );
  }

  if (mode === "edit" && connectionCase && project.canManageConnectionCase) {
    return (
      <ConnectionCaseForm
        action={updateConnectionCaseAction}
        project={project}
        operators={operators}
        caseRecord={connectionCase}
        submitLabel="Save connection case"
        onCancel={() => setMode("view")}
        defaults={{
          gridOperatorId: connectionCase.gridOperatorId ?? "",
          stage: connectionCase.stageValue,
          status: connectionCase.statusValue,
          caseId: connectionCase.caseId ?? "",
          submittedAt: connectionCase.submittedAt ?? "",
          nextMilestone: connectionCase.nextMilestone ?? "",
          deadline: connectionCase.deadline ?? "",
          notes: connectionCase.notes ?? "",
        }}
      />
    );
  }

  if (!connectionCase) {
    return (
      <section className="rounded-md border border-line bg-surface p-5">
        <h3 className="text-base font-semibold">No connection case yet</h3>
        <p className="mt-2 text-sm text-muted">
          Start a connection process when you are ready to track operator interaction for this
          project.
        </p>
        {project.canManageConnectionCase ? (
          <Button className="mt-4" onClick={() => setMode("create")}>
            Start connection process
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <ConnectionCaseSummary
      project={project}
      connectionCase={connectionCase}
      onEdit={project.canManageConnectionCase ? () => setMode("edit") : undefined}
    />
  );
}

function ConnectionCaseSummary({
  project,
  connectionCase,
  onEdit,
}: {
  project: ProjectDetailViewModel;
  connectionCase: ProjectConnectionCase;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (
      !window.confirm(
        "Delete this connection case? Requirements linked to it stay on the project.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteConnectionCaseAction(connectionCase.id, project.slug);
      if (!result.ok) {
        setError(result.error ?? "Could not delete the connection case.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{connectionCase.stage}</h3>
          <p className="mt-1 text-sm text-muted">
            {connectionCase.gridOperatorName || "No operator set"}
            {connectionCase.caseId ? ` · ${connectionCase.caseId}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${project.slug}`}
            className={buttonClassName("secondary")}
          >
            Open project
          </Link>
          {onEdit ? (
            <Button variant="secondary" onClick={onEdit}>
              Edit case
            </Button>
          ) : null}
          {project.canDeleteConnectionCase ? (
            <Button variant="danger" onClick={onDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete case"}
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-critical">{error}</p> : null}
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <Row label="Status" value={connectionCase.status} />
        <Row
          label="Submitted"
          value={connectionCase.submittedAt ? formatDate(connectionCase.submittedAt) : "—"}
        />
        <Row label="Next milestone" value={connectionCase.nextMilestone ?? "—"} />
        <Row
          label="Deadline"
          value={connectionCase.deadline ? formatDate(connectionCase.deadline) : "—"}
        />
        <Row label="Owner" value={connectionCase.ownerName ?? "—"} />
      </dl>
      {connectionCase.notes ? (
        <p className="mt-3 text-sm leading-6 text-muted">{connectionCase.notes}</p>
      ) : null}
    </section>
  );
}

function ConnectionCaseForm({
  action,
  project,
  operators,
  caseRecord,
  defaults,
  submitLabel,
  onCancel,
}: {
  action: (
    state: ConnectionCaseMutationState,
    formData: FormData,
  ) => Promise<ConnectionCaseMutationState>;
  project: ProjectDetailViewModel;
  operators: GridOperatorOption[];
  caseRecord?: ProjectConnectionCase;
  defaults: NonNullable<ConnectionCaseMutationState["values"]>;
  submitLabel: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const values = { ...defaults, ...state.values };

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h3 className="text-base font-semibold">
        {caseRecord ? "Edit connection case" : "Start connection process"}
      </h3>
      <p className="mt-1 text-sm text-muted">
        Customer workflow data only. This does not change official Ei geographic context.
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="projectSlug" value={project.slug} />
        {caseRecord ? <input type="hidden" name="caseIdKey" value={caseRecord.id} /> : null}
        {state.error ? (
          <p className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
            {state.error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grid operator" error={state.fieldErrors?.gridOperatorId}>
            <select
              name="gridOperatorId"
              defaultValue={values.gridOperatorId}
              className={inputClass}
            >
              <option value="">Not set</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage" error={state.fieldErrors?.stage}>
            <select name="stage" defaultValue={values.stage} className={inputClass} required>
              {PROJECT_STAGE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {pipelineStageLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={state.fieldErrors?.status}>
            <select name="status" defaultValue={values.status} className={inputClass} required>
              {CONNECTION_CASE_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {connectionCaseStatusLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Case reference" error={state.fieldErrors?.caseId}>
            <input
              name="caseId"
              defaultValue={values.caseId}
              className={inputClass}
              placeholder="Optional operator reference"
            />
          </Field>
          <Field label="Submitted" error={state.fieldErrors?.submittedAt}>
            <input
              name="submittedAt"
              type="date"
              defaultValue={values.submittedAt}
              className={inputClass}
            />
          </Field>
          <Field label="Deadline" error={state.fieldErrors?.deadline}>
            <input
              name="deadline"
              type="date"
              defaultValue={values.deadline}
              className={inputClass}
            />
          </Field>
          <Field label="Next milestone" className="sm:col-span-2">
            <input
              name="nextMilestone"
              defaultValue={values.nextMilestone}
              className={inputClass}
              placeholder="Optional milestone description"
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              name="notes"
              defaultValue={values.notes}
              rows={3}
              className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="text-muted">{label}</span>
      {children}
      {error ? <p className="mt-1 text-xs text-critical">{error}</p> : null}
    </label>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-[70%] text-right">{value}</dd>
    </div>
  );
}
