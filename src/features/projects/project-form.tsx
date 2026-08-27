"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import type { GridOperatorOption } from "@/lib/data/grid-operators";
import {
  PROJECT_CONFIDENCE_VALUES,
  PROJECT_OUTLOOK_VALUES,
  PROJECT_STAGE_VALUES,
  PROJECT_TECHNOLOGY_VALUES,
  confidenceLabel,
  outlookLabel,
  pipelineStageLabel,
  technologyLabel,
} from "@/lib/domain/catalog-labels";
import type { ProjectMutationState } from "@/lib/projects/actions";
import type { ProjectFormInput } from "@/lib/projects/validation";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";

const INITIAL: ProjectMutationState = {};

const EMPTY_VALUES: ProjectFormInput = {
  name: "",
  technology: "battery_storage",
  location: "",
  latitude: "",
  longitude: "",
  importMw: "",
  exportMw: "",
  gridOperatorId: "",
  connectionStage: "prospect",
  connectionOutlook: "unknown",
  confidence: "unknown",
  targetCod: "",
};

export function ProjectForm({
  action,
  operators,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (state: ProjectMutationState, formData: FormData) => Promise<ProjectMutationState>;
  operators: GridOperatorOption[];
  defaults?: Partial<ProjectFormInput>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const values = { ...EMPTY_VALUES, ...defaults, ...state.values };
  const errors = state.fieldErrors ?? {};

  return (
    <form
      key={state.error ? "error" : "ok"}
      action={formAction}
      className="max-w-3xl space-y-6"
    >
      {state.error ? (
        <p className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
          {state.error}
        </p>
      ) : null}

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Project</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Project name" error={errors.name} className="sm:col-span-2">
            <input
              name="name"
              defaultValue={values.name}
              required
              className={inputClass}
              placeholder="Gävle Battery North"
            />
          </Field>
          <Field label="Technology" error={errors.technology}>
            <select name="technology" defaultValue={values.technology} className={inputClass}>
              {PROJECT_TECHNOLOGY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {technologyLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location / place" error={errors.location}>
            <input
              name="location"
              defaultValue={values.location}
              className={inputClass}
              placeholder="Stockholm"
            />
          </Field>
          <Field label="Latitude" error={errors.latitude}>
            <input
              name="latitude"
              defaultValue={values.latitude}
              required
              inputMode="decimal"
              className={inputClass}
              placeholder="59.3293"
            />
          </Field>
          <Field label="Longitude" error={errors.longitude}>
            <input
              name="longitude"
              defaultValue={values.longitude}
              required
              inputMode="decimal"
              className={inputClass}
              placeholder="18.0686"
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">
          Coordinates are stored as the primary site in EPSG:4326 (longitude = X, latitude = Y).
          Location text is not geocoded.
        </p>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Capacity and connection</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Import MW" error={errors.importMw}>
            <input
              name="importMw"
              defaultValue={values.importMw}
              inputMode="decimal"
              className={inputClass}
              placeholder="20"
            />
          </Field>
          <Field label="Export MW" error={errors.exportMw}>
            <input
              name="exportMw"
              defaultValue={values.exportMw}
              inputMode="decimal"
              className={inputClass}
              placeholder="20"
            />
          </Field>
          <Field
            label="Project / connection operator"
            error={errors.gridOperatorId}
            hint="Customer-selected. May differ from official Ei local-network or NUP companies."
          >
            <select name="gridOperatorId" defaultValue={values.gridOperatorId} className={inputClass}>
              <option value="">Not set</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Connection stage" error={errors.connectionStage}>
            <select
              name="connectionStage"
              defaultValue={values.connectionStage}
              className={inputClass}
            >
              {PROJECT_STAGE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {pipelineStageLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Team outlook"
            error={errors.connectionOutlook}
            hint="Customer-entered assessment for triage — not NOXHEIM Grid Intelligence."
          >
            <select
              name="connectionOutlook"
              defaultValue={values.connectionOutlook}
              className={inputClass}
            >
              {PROJECT_OUTLOOK_VALUES.map((value) => (
                <option key={value} value={value}>
                  {outlookLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Team confidence"
            error={errors.confidence}
            hint="Customer-entered confidence in your own assessment — not an official score."
          >
            <select name="confidence" defaultValue={values.confidence} className={inputClass}>
              {PROJECT_CONFIDENCE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {confidenceLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target COD" error={errors.targetCod}>
            <input
              name="targetCod"
              defaultValue={values.targetCod}
              className={inputClass}
              placeholder="2028"
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonClassName("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

const inputClass =
  "mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink";

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="text-muted">{label}</span>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-critical">{error}</p> : null}
    </label>
  );
}
