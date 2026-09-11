"use client";

import { MapFact, MapObjectPanel, MapPanelNote } from "@/features/map/map-object-panel";
import type { OfficialMapAreaContext } from "@/lib/data/official-map";
import {
  COVERING_OFFICIAL_AREA_LABEL,
  NUP_FORECAST_NEED_MAP_DISCLAIMER,
  type OfficialMapAreaPreview,
} from "@/lib/domain/official-map";
import { nupPlanningScopeLabel } from "@/lib/domain/catalog-labels";
import { formatDate } from "@/lib/format";

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
  const kind = layer === "planning_area" ? "Network development plan" : "Local network area";
  const areaFact =
    layer === "local_network"
      ? concessionId || externalId || "—"
      : nupPlanningScopeLabel(delomrade);

  return (
    <MapObjectPanel
      kind={kind}
      provenance="Official Source · Ei"
      title={name}
      testId="map-official-panel"
      onClose={onClose}
    >
      {fromPublishedChange ? (
        <p className="mb-3 text-xs leading-5 text-muted">
          Official area from a published change. Outline marks this area; lighter polygons are normal context.
        </p>
      ) : null}
      <dl className="space-y-1.5">
        <MapFact label="Source" value="Energimarknadsinspektionen" />
        <MapFact label="Official company" value={operator || "—"} />
        <MapFact
          label={layer === "local_network" ? "Concession / area" : "Planning area"}
          value={pendingDetails ? "Loading…" : areaFact}
        />
        {layer === "planning_area" ? (
          <MapFact label="Accounting unit" value={pendingDetails ? "Loading…" : accountingUnit || "—"} />
        ) : null}
        <MapFact
          label="Published"
          value={
            pendingDetails
              ? "Loading…"
              : context?.provenance?.publishedAt
                ? formatDate(context.provenance.publishedAt)
                : "—"
          }
        />
        <MapFact
          label="Retrieved"
          value={
            pendingDetails
              ? "Loading…"
              : context?.provenance?.retrievedAt
                ? formatDate(context.provenance.retrievedAt)
                : "—"
          }
        />
      </dl>
      {layer === "planning_area" ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-medium">Forecast transfer-capacity need</p>
          <p className="mt-1 text-[11px] leading-4 text-muted">{NUP_FORECAST_NEED_MAP_DISCLAIMER}</p>
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
      <MapPanelNote>
        {COVERING_OFFICIAL_AREA_LABEL} — geographic covering, not a connection point and not available
        connection capacity.
      </MapPanelNote>
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
    </MapObjectPanel>
  );
}
