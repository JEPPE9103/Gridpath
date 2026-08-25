"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badges";
import type { ProjectDetailViewModel, ProjectRequirementItem } from "@/lib/data/project-detail-types";
import {
  REQUIREMENT_CATEGORY_VALUES,
  REQUIREMENT_STATUS_VALUES,
  checklistStatusLabel,
  requirementCategoryLabel,
} from "@/lib/domain/catalog-labels";
import { canCompleteChecklist, formatDate } from "@/lib/format";
import {
  createRequirementAction,
  deleteRequirementAction,
  markRequirementComplete,
  updateRequirementAction,
  type RequirementMutationState,
} from "@/lib/requirements/actions";
import { Check, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast-provider";

const INITIAL: RequirementMutationState = {};

const inputClass =
  "mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink";

export function RequirementsManager({ project }: { project: ProjectDetailViewModel }) {
  const { pushToast } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<ProjectRequirementItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onComplete(itemId: string) {
    setPendingId(itemId);
    startTransition(async () => {
      const result = await markRequirementComplete(itemId, project.slug);
      if (!result.ok) {
        pushToast({
          title: "Could not update requirement",
          description: "The change was not saved.",
          tone: "warning",
        });
        return;
      }
      router.refresh();
      pushToast({
        title: "Application readiness updated",
        description: "Requirement marked complete.",
        tone: "success",
      });
    });
  }

  function onDelete(item: ProjectRequirementItem) {
    if (!window.confirm(`Delete requirement “${item.label}”?`)) {
      return;
    }
    setPendingId(item.id);
    startTransition(async () => {
      const result = await deleteRequirementAction(item.id, project.slug);
      if (!result.ok) {
        pushToast({
          title: "Could not delete requirement",
          description: result.error ?? "The change was not saved.",
          tone: "warning",
        });
        return;
      }
      router.refresh();
      pushToast({
        title: "Requirement deleted",
        description: "Application readiness was recalculated.",
        tone: "success",
      });
    });
  }

  if (mode === "create" && project.canUpdateRequirements) {
    return (
      <RequirementForm
        action={createRequirementAction}
        project={project}
        submitLabel="Add requirement"
        onCancel={() => setMode("list")}
        defaults={{
          label: "",
          category: "grid",
          required: true,
          status: "not_started",
          dueDate: "",
        }}
      />
    );
  }

  if (mode === "edit" && editing && project.canUpdateRequirements) {
    return (
      <RequirementForm
        action={updateRequirementAction}
        project={project}
        requirement={editing}
        submitLabel="Save requirement"
        onCancel={() => {
          setMode("list");
          setEditing(null);
        }}
        defaults={{
          label: editing.label,
          category:
            REQUIREMENT_CATEGORY_VALUES.find(
              (value) => requirementCategoryLabel(value) === editing.category,
            ) ?? "other",
          required: editing.required,
          status:
            REQUIREMENT_STATUS_VALUES.find(
              (value) => checklistStatusLabel(value) === editing.status,
            ) ?? "not_started",
          dueDate: editing.dueDate ?? "",
        }}
      />
    );
  }

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Application readiness</h2>
          <p className="mt-1 text-sm text-muted">
            Required requirements only. Optional items do not reduce readiness.
          </p>
        </div>
        <p className="font-mono text-3xl font-semibold text-ink">
          {project.readinessPercent == null ? (
            <span className="text-lg font-sans font-medium text-muted">Not available</span>
          ) : (
            <>
              {project.readinessPercent}%
              <span className="ml-1 text-sm font-sans font-medium text-muted">Ready</span>
            </>
          )}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
        <div className="h-full bg-teal" style={{ width: `${project.readinessPercent ?? 0}%` }} />
      </div>

      {project.canUpdateRequirements ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setMode("create")}>
            Add requirement
          </Button>
        </div>
      ) : null}

      {project.requirements.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No requirements yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {project.requirements.map((item) => {
            const complete = item.status === "Complete";
            const interactive =
              project.canUpdateRequirements && canCompleteChecklist(item.status);
            return (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {complete ? (
                      <Check size={14} className="shrink-0 text-success" />
                    ) : (
                      <Circle size={14} className="shrink-0 text-muted" />
                    )}
                    <span className="text-sm">{item.label}</span>
                    {!item.required ? (
                      <span className="text-[10px] uppercase tracking-wide text-muted">
                        Optional
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 pl-6 text-xs text-muted">
                    {[
                      item.category,
                      item.dueDate ? `Due ${formatDate(item.dueDate)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <StatusBadge status={item.status} />
                  {interactive ? (
                    <Button
                      variant="ghost"
                      onClick={() => onComplete(item.id)}
                      disabled={isPending && pendingId === item.id}
                    >
                      Mark complete
                    </Button>
                  ) : null}
                  {project.canUpdateRequirements ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(item);
                        setMode("edit");
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {project.canDeleteRequirements ? (
                    <Button
                      variant="ghost"
                      onClick={() => onDelete(item)}
                      disabled={isPending && pendingId === item.id}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RequirementForm({
  action,
  project,
  requirement,
  defaults,
  submitLabel,
  onCancel,
}: {
  action: (
    state: RequirementMutationState,
    formData: FormData,
  ) => Promise<RequirementMutationState>;
  project: ProjectDetailViewModel;
  requirement?: ProjectRequirementItem;
  defaults: NonNullable<RequirementMutationState["values"]>;
  submitLabel: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const values = { ...defaults, ...state.values };

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">
        {requirement ? "Edit requirement" : "Add requirement"}
      </h2>
      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="projectSlug" value={project.slug} />
        {requirement ? <input type="hidden" name="requirementId" value={requirement.id} /> : null}
        {project.connectionCase ? (
          <input type="hidden" name="connectionCaseId" value={project.connectionCase.id} />
        ) : null}
        {state.error ? (
          <p className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
            {state.error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" error={state.fieldErrors?.label} className="sm:col-span-2">
            <input
              name="label"
              required
              defaultValue={values.label}
              className={inputClass}
              placeholder="Network impact assessment"
            />
          </Field>
          <Field label="Category" error={state.fieldErrors?.category}>
            <select name="category" defaultValue={values.category} className={inputClass}>
              {REQUIREMENT_CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {requirementCategoryLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={state.fieldErrors?.status}>
            <select name="status" defaultValue={values.status} className={inputClass}>
              {REQUIREMENT_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {checklistStatusLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" error={state.fieldErrors?.dueDate}>
            <input
              name="dueDate"
              type="date"
              defaultValue={values.dueDate}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="required"
              value="true"
              defaultChecked={values.required}
              className="rounded border-line"
            />
            <span>Required for application readiness</span>
          </label>
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
