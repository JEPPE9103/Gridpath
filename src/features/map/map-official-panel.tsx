"use client";

import { Button } from "@/components/ui/button";
import type { OfficialMapAreaContext } from "@/lib/data/official-map";
import {
  COVERING_OFFICIAL_AREA_LABEL,
  NUP_FORECAST_NEED_MAP_DISCLAIMER,
  type OfficialMapAreaPreview,
} from "@/lib/domain/official-map";
import { nupPlanningScopeLabel } from "@/lib/domain/catalog-labels";
import { formatDate } from "@/lib/format";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function MapOfficialPanel({
  preview,
  context,
  loading,
  fromPublishedChange = false,
  onClose,
}: {
  preview: OfficialMapAreaPreview;
  context: OfficialMapAreaContext | null;
  loading: boolean;
  fromPublishedChange?: boolean;
  onClose: () => void;
}) {
  const name = context?.name || preview.name || "Official area";
  const layer = context?.layer ?? preview.layer;
  const operator = context?.officialOperatorName ?? preview.officialOperatorName;
  const concessionId = context?.concessionId ?? preview.concessionId;
  const externalId = context?.externalId ?? preview.externalId;
  const accountingUnit = context?.accountingUnit ?? preview.accountingUnit;
  const delomrade = context?.delomrade ?? preview.delomrade;
  const pendingDetails = loading && !context;

  return (
    <aside className="absolute inset-x-3 bottom-3 max-h-[58%] overflow-auto rounded-md border border-line bg-surface p-4 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[320px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Official source</p>
          <h2 className="text-base font-semibold">{name}</h2>
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Close official panel">
          <X size={14} />
        </button>
      </div>
      {fromPublishedChange ? (
        <p className="mt-3 text-xs leading-5 text-muted">
          Official area from a published change. Thicker outline marks this area; lighter covering
          polygons are normal project context. This is covering geography, not a technical impact.
        </p>
      ) : null}
      <dl className="mt-3 space-y-1.5 text-sm">
        <Line
          label="Layer"
          value={layer === "planning_area" ? "Network development plan" : "Local network area"}
        />
        <Line label="Official company" value={operator || "—"} />
        {layer === "local_network" ? (
          <Line label="Concession ID" value={concessionId || externalId || "—"} />
        ) : (
          <>
            <Line label="Accounting unit" value={accountingUnit || "—"} />
            <Line label="Planning area" value={nupPlanningScopeLabel(delomrade)} />
          </>
        )}
        <Line label={COVERING_OFFICIAL_AREA_LABEL} value="Geographic covering, not a connection point" />
        <Line
          label="Projects in this workspace"
          value={
            pendingDetails
              ? "Loading…"
              : context?.projectCount == null
                ? "—"
                : String(context.projectCount)
          }
        />
        <Line
          label="Publisher"
          value={
            pendingDetails
              ? "Loading…"
              : context?.provenance?.publisher || "Energimarknadsinspektionen"
          }
        />
        <Line label="Dataset" value={pendingDetails ? "Loading…" : context?.provenance?.dataType || "—"} />
        <Line
          label="Published / source date"
          value={
            pendingDetails
              ? "Loading…"
              : context?.provenance?.publishedAt
                ? formatDate(context.provenance.publishedAt)
                : "—"
          }
        />
        <Line
          label="Retrieved by NOXHEIM"
          value={
            pendingDetails
              ? "Loading…"
              : context?.provenance?.retrievedAt
                ? formatDate(context.provenance.retrievedAt)
                : "—"
          }
        />
        {context?.provenance?.planningPeriod ? (
          <Line label="Forecast period" value={context.provenance.planningPeriod} />
        ) : null}
      </dl>
      {layer === "planning_area" ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-medium">Forecast transfer-capacity need</p>
          <p className="mt-1 text-xs leading-5 text-muted">{NUP_FORECAST_NEED_MAP_DISCLAIMER}</p>
          {pendingDetails ? (
            <p className="mt-2 text-sm text-muted">Loading published forecast figures…</p>
          ) : !context || context.forecastTransferCapacityNeed.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Not published in the current dataset.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {context.forecastTransferCapacityNeed.slice(0, 6).map((item) => (
                <li key={item.year} className="flex justify-between gap-3">
                  <span className="font-mono text-xs">{item.year}</span>
                  <span>
                    {item.representation === "numeric_mw" && item.valueNumeric != null
                      ? `${item.valueNumeric} MW`
                      : (item.valueText ?? "—")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {context?.provenance?.sourceUrl ? (
        <a
          href={context.provenance.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-teal hover:underline"
        >
          Official source
        </a>
      ) : null}
      <div className="mt-3">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </aside>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
