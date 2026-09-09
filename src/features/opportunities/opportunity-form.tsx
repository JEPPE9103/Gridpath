"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import type { OpportunityMutationState } from "@/lib/opportunities/actions";
import { OPPORTUNITY_TECHNOLOGY_VALUES, opportunityTechnologyLabel } from "@/lib/opportunities/catalog";
import type { OpportunityFormInput } from "@/lib/opportunities/validation";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";

const INITIAL: OpportunityMutationState = {};

const EMPTY: OpportunityFormInput = {
  name: "",
  technology: "battery_storage",
  country: "SE",
  region: "",
  municipality: "",
  latitude: "",
  longitude: "",
  targetMw: "",
  targetMwh: "",
  siteAreaHa: "",
  minSiteAreaHa: "",
  maxDistanceKm: "",
  excludeProtected: "",
  excludeNatura: "",
  maxSlopePercent: "",
  minDistanceResidentialM: "",
  notes: "",
};

const inputClass =
  "mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink";

export function OpportunityForm({
  action,
}: {
  action: (state: OpportunityMutationState, formData: FormData) => Promise<OpportunityMutationState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const values = { ...EMPTY, ...state.values };
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state.error ? (
        <p className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
          {state.error}
        </p>
      ) : null}

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">What you are looking for</h2>
        <p className="mt-1 text-sm text-muted">
          Criteria are stored so this search can be reproduced. Missing datasets stay marked as
          insufficient evidence — they are not treated as a pass.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Opportunity name" error={errors.name} className="sm:col-span-2">
            <input name="name" defaultValue={values.name} required className={inputClass} />
          </Field>
          <Field label="Technology" error={errors.technology}>
            <select name="technology" defaultValue={values.technology} className={inputClass}>
              {OPPORTUNITY_TECHNOLOGY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {opportunityTechnologyLabel(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Country" hint="Sweden is the first supported geography.">
            <input name="country" defaultValue={values.country} className={inputClass} />
          </Field>
          <Field label="Region">
            <input name="region" defaultValue={values.region} className={inputClass} />
          </Field>
          <Field label="Municipality">
            <input name="municipality" defaultValue={values.municipality} className={inputClass} />
          </Field>
          <Field label="Target MW" error={errors.targetMw}>
            <input name="targetMw" defaultValue={values.targetMw} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Target MWh" error={errors.targetMwh}>
            <input name="targetMwh" defaultValue={values.targetMwh} className={inputClass} inputMode="decimal" />
          </Field>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Site</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" error={errors.latitude}>
            <input name="latitude" defaultValue={values.latitude} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Longitude" error={errors.longitude}>
            <input name="longitude" defaultValue={values.longitude} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Site area (ha)" error={errors.siteAreaHa}>
            <input name="siteAreaHa" defaultValue={values.siteAreaHa} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Minimum site area (ha)" error={errors.minSiteAreaHa}>
            <input name="minSiteAreaHa" defaultValue={values.minSiteAreaHa} className={inputClass} inputMode="decimal" />
          </Field>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Constraints</h2>
        <p className="mt-1 text-sm text-muted">
          Protected-area, Natura 2000, slope and access layers are not integrated yet. Configuring
          them records intent; they do not silently pass a candidate.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Max distance to infrastructure (km)" error={errors.maxDistanceKm}>
            <input name="maxDistanceKm" defaultValue={values.maxDistanceKm} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Maximum slope (%)" error={errors.maxSlopePercent}>
            <input name="maxSlopePercent" defaultValue={values.maxSlopePercent} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Minimum distance from residential (m)" error={errors.minDistanceResidentialM} className="sm:col-span-2">
            <input
              name="minDistanceResidentialM"
              defaultValue={values.minDistanceResidentialM}
              className={inputClass}
              inputMode="decimal"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="excludeProtected" defaultChecked={values.excludeProtected === "on"} />
            Exclude protected areas when a supported layer exists
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="excludeNatura" defaultChecked={values.excludeNatura === "on"} />
            Exclude Natura 2000 when a supported layer exists
          </label>
          <Field label="Notes" className="sm:col-span-2">
            <textarea name="notes" defaultValue={values.notes} rows={3} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm" />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Screening…" : "Save opportunity"}
        </Button>
        <Link href="/opportunities" className={buttonClassName("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

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
