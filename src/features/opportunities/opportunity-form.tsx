"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { ScreeningProgressOverlay } from "@/features/opportunities/screening-progress";
import type { OpportunityMutationState } from "@/lib/opportunities/actions";
import { OPPORTUNITY_TECHNOLOGY_VALUES, opportunityTechnologyLabel } from "@/lib/opportunities/catalog";
import { LAND_COVER_GROUPS, LAND_COVER_RULES } from "@/lib/opportunities/land-cover";
import { originLabel, type ScreeningProfileRecord } from "@/lib/opportunities/screening-profiles";
import type { OpportunityFormInput } from "@/lib/opportunities/validation";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { SearchAreaPicker } from "@/features/opportunities/search-area-picker";

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
  "mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

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
  const [bbox, setBbox] = useState({
    west: values.west,
    south: values.south,
    east: values.east,
    north: values.north,
  });

  return (
    <form action={formAction} className="relative max-w-3xl space-y-6">
      {pending ? <ScreeningProgressOverlay variant={searchMode === "geography" ? "discovery" : "refine"} /> : null}

      {state.error ? (
        <p className="rounded-md border border-critical/30 bg-critical-bg px-3 py-2 text-sm text-critical" role="alert">
          {state.error}
        </p>
      ) : null}

      <fieldset disabled={pending} className={pending ? "pointer-events-none opacity-40" : undefined}>
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Screening profile</h2>
          <p className="mt-1 text-sm text-muted">
            Start from the NOXHEIM Sweden BESS default or reuse an organisation profile. Defaults are
            suggestions, not engineering rules.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Saved profile"
              hint={`${originLabel("noxheim_default")} values are pre-filled below until you change them.`}
            >
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

        <section className="mt-6 rounded-md border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Core screening parameters</h2>
          <p className="mt-1 text-sm text-muted">
            Geographic screening returns ranked Candidate Sites grown to your target footprint inside
            broader Opportunity Zones. Discovery screening identifies Candidate Sites from coarse
            official evidence. Results are not land parcels. Official environmental layers and
            NMD 2023 land cover are applied when ingested.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Search name" error={errors.name} className="sm:col-span-2">
              <input name="name" defaultValue={values.name} required className={inputClass} />
            </Field>
            <Field label="Project type" error={errors.technology}>
              <select name="technology" defaultValue={values.technology} className={inputClass}>
                {OPPORTUNITY_TECHNOLOGY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {opportunityTechnologyLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <p className="text-sm text-muted">Search type</p>
              <div className="mt-2 flex flex-col gap-2 text-sm">
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
            </div>
          </div>
        </section>

        {searchMode === "geography" ? (
          <section className="mt-6 rounded-md border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Search area</h2>
            <p className="mt-1 text-sm text-muted">
              Draw a rectangular envelope on the map, or enter coordinates. This is not a municipality
              or cadastral polygon. Clipped to Sweden. Maximum 15 000 km².
            </p>
            <div className="mt-4">
              <SearchAreaPicker
                west={bbox.west}
                south={bbox.south}
                east={bbox.east}
                north={bbox.north}
                onChange={setBbox}
              />
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Manual coordinates</p>
            <p className="mt-1 text-xs text-muted">
              Examples: Hallsberg — west 14.9, south 59.1, east 15.4, north 59.4. Västerås — west 16.30,
              south 59.47, east 16.90, north 59.73.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="West" error={errors.west}>
                <input
                  name="west"
                  value={bbox.west}
                  onChange={(event) => setBbox((current) => ({ ...current, west: event.target.value }))}
                  className={inputClass}
                  inputMode="decimal"
                />
              </Field>
              <Field label="South" error={errors.south}>
                <input
                  name="south"
                  value={bbox.south}
                  onChange={(event) => setBbox((current) => ({ ...current, south: event.target.value }))}
                  className={inputClass}
                  inputMode="decimal"
                />
              </Field>
              <Field label="East" error={errors.east}>
                <input
                  name="east"
                  value={bbox.east}
                  onChange={(event) => setBbox((current) => ({ ...current, east: event.target.value }))}
                  className={inputClass}
                  inputMode="decimal"
                />
              </Field>
              <Field label="North" error={errors.north}>
                <input
                  name="north"
                  value={bbox.north}
                  onChange={(event) => setBbox((current) => ({ ...current, north: event.target.value }))}
                  className={inputClass}
                  inputMode="decimal"
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Minimum usable area (ha)"
                error={errors.minSiteAreaHa}
                hint="Largest contiguous remaining area inside a Candidate Site. Default 8 ha."
              >
                <input name="minSiteAreaHa" defaultValue={values.minSiteAreaHa} className={inputClass} inputMode="decimal" />
              </Field>
              <Field
                label="Target site area (ha)"
                error={errors.targetSiteAreaHa}
                hint="Investigation footprint preference. Extra hectares above this do not automatically rank higher. Default 15 ha."
              >
                <input
                  name="targetSiteAreaHa"
                  defaultValue={values.targetSiteAreaHa}
                  className={inputClass}
                  inputMode="decimal"
                />
              </Field>
              <Field
                label="Maximum site area (ha)"
                error={errors.maxCandidateAreaHa}
                hint="Cap so a surviving region is not returned as one site. Default 30 ha."
              >
                <input
                  name="maxCandidateAreaHa"
                  defaultValue={values.maxCandidateAreaHa}
                  className={inputClass}
                  inputMode="decimal"
                />
              </Field>
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-md border border-line bg-surface p-5">
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
              <Field label="Minimum usable area (ha)" error={errors.minSiteAreaHa}>
                <input name="minSiteAreaHa" defaultValue={values.minSiteAreaHa} className={inputClass} inputMode="decimal" />
              </Field>
            </div>
          </section>
        )}

        <details className="mt-6 rounded-md border border-line bg-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            Advanced screening settings
          </summary>
          <p className="mt-2 text-sm text-muted">
            Expert constraints stay available. Protected-area and Natura 2000 exclusions apply when
            Naturvårdsverket layers have been ingested. Discovery slope uses Copernicus DEM GLO-90
            summaries when ingested (DSM, not a DTM). Land cover uses NMD 2023 (NMD 2018 legacy fallback
            only).
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
            <Field
              label="Maximum slope (degrees)"
              error={errors.maxSlopeDegrees}
              hint="Prefer degrees. Legacy percent is still accepted if set."
            >
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
            <Field label="Road distance mode">
              <select name="roadMode" defaultValue={values.roadMode} className={inputClass}>
                <option value="preference">Preference</option>
                <option value="hard">Hard exclusion</option>
              </select>
            </Field>
            <Field label="Maximum distance to supported road (m)" error={errors.maxRoadDistanceM}>
              <input name="maxRoadDistanceM" defaultValue={values.maxRoadDistanceM} className={inputClass} inputMode="decimal" />
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
            <Field
              label="Maximum sites returned"
              error={errors.maxReturnedCandidates}
              hint="Operational cap after overlap deduplication. Default 25 (hard cap 100)."
            >
              <input
                name="maxReturnedCandidates"
                defaultValue={values.maxReturnedCandidates}
                className={inputClass}
                inputMode="decimal"
              />
            </Field>
            <Field label="Country" hint="Sweden is the first supported geography.">
              <input name="country" defaultValue={values.country} className={inputClass} />
            </Field>
            <Field
              label="Electricity area"
              error={errors.electricityArea}
              hint="SE1–SE4 is stored as intent only. Official bidding-zone geometry is not integrated."
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
            <Field label="Max preliminary investigation distance (km)" error={errors.maxDistanceKm}>
              <input name="maxDistanceKm" defaultValue={values.maxDistanceKm} className={inputClass} inputMode="decimal" />
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
        </details>
      </fieldset>

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
