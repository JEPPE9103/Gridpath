"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import type { OpportunityMutationState } from "@/lib/opportunities/actions";
import { OPPORTUNITY_TECHNOLOGY_VALUES, opportunityTechnologyLabel } from "@/lib/opportunities/catalog";
import { LAND_COVER_GROUPS, LAND_COVER_RULES } from "@/lib/opportunities/land-cover";
import { originLabel, type ScreeningProfileRecord } from "@/lib/opportunities/screening-profiles";
import type { OpportunityFormInput } from "@/lib/opportunities/validation";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

const INITIAL: OpportunityMutationState = {};

const EMPTY: OpportunityFormInput = {
  name: "",
  technology: "battery_storage",
  country: "SE",
  region: "",
  municipality: "",
  electricityArea: "",
  searchMode: "geography",
  west: "",
  south: "",
  east: "",
  north: "",
  latitude: "",
  longitude: "",
  targetMw: "",
  targetMwh: "",
  siteAreaHa: "",
  minSiteAreaHa: "8",
  targetSiteAreaHa: "15",
  maxCandidateAreaHa: "30",
  maxReturnedCandidates: "25",
  maxDistanceKm: "",
  excludeProtected: "on",
  excludeNatura: "on",
  maxSlopePercent: "",
  maxSlopeDegrees: "5",
  slopeMode: "preference",
  maxRoadDistanceM: "1000",
  roadMode: "preference",
  landCoverWater: "excluded",
  landCoverWetland: "excluded",
  landCoverForest: "neutral",
  landCoverAgriculture: "deprioritised",
  landCoverOpen: "preferred",
  landCoverDeveloped: "deprioritised",
  profileId: "",
  saveProfileName: "",
  investigationBudgetNote: "",
  hurdleNote: "",
  minDistanceResidentialM: "",
  notes: "",
};

const inputClass =
  "mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink";

const LAND_COVER_FIELDS: Array<{ key: keyof OpportunityFormInput; group: (typeof LAND_COVER_GROUPS)[number] }> = [
  { key: "landCoverWater", group: "water" },
  { key: "landCoverWetland", group: "wetland" },
  { key: "landCoverForest", group: "forest" },
  { key: "landCoverAgriculture", group: "agriculture" },
  { key: "landCoverOpen", group: "open" },
  { key: "landCoverDeveloped", group: "developed" },
];

export function OpportunityForm({
  action,
  profiles = [],
}: {
  action: (state: OpportunityMutationState, formData: FormData) => Promise<OpportunityMutationState>;
  profiles?: ScreeningProfileRecord[];
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const values = { ...EMPTY, ...state.values };
  const errors = state.fieldErrors ?? {};
  const [searchMode, setSearchMode] = useState(values.searchMode === "point" ? "point" : "geography");

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state.error ? (
        <p className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical">
          {state.error}
        </p>
      ) : null}

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Screening profile</h2>
        <p className="mt-1 text-sm text-muted">
          Reuse an organisation profile or start from the NOXHEIM default. Defaults are suggestions, not
          engineering rules. Saved profiles are organisation-scoped.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Saved profile" hint={`${originLabel("noxheim_default")} values are pre-filled below until you change them.`}>
            <select name="profileId" defaultValue={values.profileId} className={inputClass}>
              <option value="">NOXHEIM DEFAULT — Sweden BESS Standard</option>
              {profiles.map((profile) => (
                <option key={profile.id ?? profile.name} value={profile.id ?? ""}>
                  {profile.name} ({originLabel(profile.origin)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Save this search as a profile">
            <input
              name="saveProfileName"
              defaultValue={values.saveProfileName}
              placeholder="Sweden BESS Standard"
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Search type</h2>
        <p className="mt-1 text-sm text-muted">
          Geographic screening returns ranked Candidate Sites grown to your configured target
          footprint inside broader Opportunity Zones. Results are not land parcels.
        </p>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="searchMode"
              value="geography"
              checked={searchMode === "geography"}
              onChange={() => setSearchMode("geography")}
            />
            Find candidate sites in a bounded Swedish geography
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="searchMode"
              value="point"
              checked={searchMode === "point"}
              onChange={() => setSearchMode("point")}
            />
            Evaluate one known candidate point
          </label>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">What you are looking for</h2>
        <p className="mt-1 text-sm text-muted">
          Criteria are stored so this search can be reproduced. Missing datasets stay marked as
          insufficient evidence — they are not treated as a pass.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Search name" error={errors.name} className="sm:col-span-2">
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
          <Field
            label="Electricity area"
            error={errors.electricityArea}
            hint="SE1–SE4 is stored as intent only. Official bidding-zone geometry is not integrated, so it is not used as a spatial clip."
          >
            <input name="electricityArea" defaultValue={values.electricityArea} placeholder="SE3" className={inputClass} />
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

      {searchMode === "geography" ? (
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Search geography</h2>
          <p className="mt-1 text-sm text-muted">
            Bounding box in WGS84. Clipped to Sweden. Maximum 15 000 km². Example for central Örebro:
            west 14.9, south 59.1, east 15.4, north 59.4.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="West" error={errors.west}>
              <input name="west" defaultValue={values.west} className={inputClass} inputMode="decimal" />
            </Field>
            <Field label="South" error={errors.south}>
              <input name="south" defaultValue={values.south} className={inputClass} inputMode="decimal" />
            </Field>
            <Field label="East" error={errors.east}>
              <input name="east" defaultValue={values.east} className={inputClass} inputMode="decimal" />
            </Field>
            <Field label="North" error={errors.north}>
              <input name="north" defaultValue={values.north} className={inputClass} inputMode="decimal" />
            </Field>
            <Field
              label="Minimum contiguous usable area (ha)"
              error={errors.minSiteAreaHa}
              hint="CUSTOMER CONFIGURED. Decision uses the largest contiguous remaining area inside the candidate site, not the sum of fragments. NOXHEIM default is 8 ha."
            >
              <input name="minSiteAreaHa" defaultValue={values.minSiteAreaHa} className={inputClass} inputMode="decimal" />
            </Field>
            <Field
              label="Target site area (ha)"
              error={errors.targetSiteAreaHa}
              hint="CUSTOMER CONFIGURED investigation footprint. Extra hectares above this value do not automatically rank higher. NOXHEIM default is 15 ha."
            >
              <input name="targetSiteAreaHa" defaultValue={values.targetSiteAreaHa} className={inputClass} inputMode="decimal" />
            </Field>
            <Field
              label="Maximum candidate site area (ha)"
              error={errors.maxCandidateAreaHa}
              hint="CUSTOMER CONFIGURED cap so a surviving region is not returned as one site. NOXHEIM default is 30 ha."
            >
              <input name="maxCandidateAreaHa" defaultValue={values.maxCandidateAreaHa} className={inputClass} inputMode="decimal" />
            </Field>
            <Field
              label="Maximum sites returned"
              error={errors.maxReturnedCandidates}
              hint="Operational cap after overlap deduplication. NOXHEIM default is 25 (hard cap 100)."
              className="sm:col-span-2"
            >
              <input name="maxReturnedCandidates" defaultValue={values.maxReturnedCandidates} className={inputClass} inputMode="decimal" />
            </Field>
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Known candidate</h2>
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
      )}

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Environmental, terrain and land cover</h2>
        <p className="mt-1 text-sm text-muted">
          Protected-area and Natura 2000 exclusions apply when Naturvårdsverket layers have been
          ingested. Discovery slope uses Copernicus DEM GLO-90 summaries when ingested (DSM, not a DTM);
          detailed screening prefers Lantmäteriet 1 m DTM when Geotorget is configured. Land cover uses
          NMD 2023 (NMD 2018 legacy fallback only) against this profile — NOXHEIM does not universally
          rank classes as good or bad. {originLabel("noxheim_default")} slope is 5° preference.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="excludeProtected" defaultChecked={values.excludeProtected === "on"} />
            Exclude protected areas when a supported layer exists
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="excludeNatura" defaultChecked={values.excludeNatura === "on"} />
            Exclude Natura 2000 when a supported layer exists
          </label>
          <Field label="Slope mode">
            <select name="slopeMode" defaultValue={values.slopeMode} className={inputClass}>
              <option value="preference">Preference</option>
              <option value="hard">Hard exclusion</option>
            </select>
          </Field>
          <Field label="Maximum slope (degrees)" error={errors.maxSlopeDegrees} hint="Prefer degrees. Legacy percent is still accepted if set.">
            <input name="maxSlopeDegrees" defaultValue={values.maxSlopeDegrees} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Legacy maximum slope (%)" error={errors.maxSlopePercent}>
            <input name="maxSlopePercent" defaultValue={values.maxSlopePercent} className={inputClass} inputMode="decimal" />
          </Field>
          {LAND_COVER_FIELDS.map((item) => (
            <Field key={item.key} label={`Land cover: ${item.group}`}>
              <select name={item.key} defaultValue={String(values[item.key] ?? "")} className={inputClass}>
                {LAND_COVER_RULES.map((rule) => (
                  <option key={rule} value={rule}>
                    {rule}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Access and development assumptions</h2>
        <p className="mt-1 text-sm text-muted">
          Road proximity uses Trafikverket RoadLink when ingested. It does not mean heavy transport can
          access the site. Residential proximity is blocked pending data rights. Investigation budget
          and hurdle notes are customer assumptions, not NOXHEIM economics.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Road distance mode">
            <select name="roadMode" defaultValue={values.roadMode} className={inputClass}>
              <option value="preference">Preference</option>
              <option value="hard">Hard exclusion</option>
            </select>
          </Field>
          <Field label="Maximum distance to supported road (m)" error={errors.maxRoadDistanceM}>
            <input name="maxRoadDistanceM" defaultValue={values.maxRoadDistanceM} className={inputClass} inputMode="decimal" />
          </Field>
          <Field label="Max preliminary investigation distance (km)" error={errors.maxDistanceKm}>
            <input name="maxDistanceKm" defaultValue={values.maxDistanceKm} className={inputClass} inputMode="decimal" />
          </Field>
          <Field
            label="Minimum distance from residential (m)"
            error={errors.minDistanceResidentialM}
            hint="Stored as intent. Not evaluated."
          >
            <input
              name="minDistanceResidentialM"
              defaultValue={values.minDistanceResidentialM}
              className={inputClass}
              inputMode="decimal"
            />
          </Field>
          <Field label="Site investigation budget / notes" className="sm:col-span-2">
            <textarea
              name="investigationBudgetNote"
              defaultValue={values.investigationBudgetNote}
              rows={2}
              className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Internal hurdle notes" className="sm:col-span-2">
            <textarea
              name="hurdleNote"
              defaultValue={values.hurdleNote}
              rows={2}
              className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea name="notes" defaultValue={values.notes} rows={3} className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm" />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? searchMode === "geography"
              ? "Running geographic screening…"
              : "Screening…"
            : searchMode === "geography"
              ? "Find candidate sites"
              : "Save opportunity"}
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
