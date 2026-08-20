"use client";

import { SourceBadge } from "@/components/ui/badges";
import { cn } from "@/lib/cn";
import {
  NUP_DATASET_LABEL,
  gridAreaTypeLabel,
  gridAuthorityLabel,
  nupHorizonLabel,
  nupPlanningScopeLabel,
  nupPublishedAnswerLabel,
} from "@/lib/domain/catalog-labels";
import {
  isNumericMwForecastSeries,
  type OfficialGridAreaContext,
  type OfficialNupContext,
  type OfficialNupFlexibilityNeed,
  type OfficialNupForecastNeed,
} from "@/lib/domain/grid-intelligence";
import { formatDate } from "@/lib/format";
import { useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const LONG_PUBLISHED_VALUE = 240;
const FLEX_ORDER = ["0-2", "3-5", "6-10"];

export function OfficialNetworkDevelopmentPlanSection({
  nup,
  localNetwork,
}: {
  nup: OfficialNupContext | null;
  localNetwork: OfficialGridAreaContext | null;
}) {
  const area = nup?.planningAreas[0] ?? null;
  const provenance = nup?.provenance ?? null;
  const matched = nup?.matchStatus === "matched" && area != null;
  const observations = area?.observations;
  const forecasts = observations?.forecastTransferCapacityNeed ?? [];
  const concessionCompany = localNetwork?.areas[0]?.officialOperatorName ?? null;
  const nupCompany = area?.officialOperatorName ?? null;
  const scopesDiffer =
    Boolean(concessionCompany) && Boolean(nupCompany) && concessionCompany !== nupCompany;

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Official network development plan</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source="Official" />
          <QuietTag>Official source · Energimarknadsinspektionen</QuietTag>
        </div>
      </div>

      {matched && area ? (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <Row label="Official NUP company" value={nupCompany || "—"} />
            <Row
              label="Accounting unit / REL"
              value={
                area.accountingUnit ? (
                  <span className="font-mono text-[13px]">{area.accountingUnit}</span>
                ) : (
                  "—"
                )
              }
            />
            <Row label="Planning area" value={nupPlanningScopeLabel(area.delomrade)} />
            <Row label="Area type" value={gridAreaTypeLabel(area.areaType)} />
            <Row
              label="Planning period"
              value={provenance?.planningPeriod || "—"}
            />
          </dl>
          <p className="mt-3">
            <QuietTag>NOXHEIM derived · Geographic project-to-planning-area match</QuietTag>
          </p>
          {scopesDiffer ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              Network concession geography and network-development-plan geography are
              separate official datasets and may represent different network or planning
              scopes.
            </p>
          ) : null}

          <ForecastNeedBlock forecasts={forecasts} />
          <PublishedAnswerBlock
            title="Planned investments"
            context="Network company reports planned investments. This is not a list of investment projects."
            value={observations?.plannedInvestments?.valueText}
          />
          <FlexibilityBlock values={observations?.flexibilityNeed ?? []} />
          <PublishedAnswerBlock
            title="Planned measures meet own-network need"
            value={observations?.plannedMeasuresMeetOwnNetworkNeed?.valueText}
          />
          <PublishedAnswerBlock
            title="Overlying network limitation"
            value={observations?.overlyingNetworkLimitation?.valueText}
          />
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No official Network Development Plan planning-area match is currently available for
          this project location.
        </p>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Provenance</h3>
        {provenance ? (
          <>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
              <Row label="Publisher" value={provenance.publisher || "Energimarknadsinspektionen"} />
              <Row label="Authority" value={gridAuthorityLabel(provenance.authorityLevel)} />
              <Row label="Dataset" value={NUP_DATASET_LABEL} />
              <Row label="Planning period" value={provenance.planningPeriod || "—"} />
              <Row
                label="Dataset updated"
                value={
                  provenance.datasetUpdate
                    ? formatDate(provenance.datasetUpdate)
                    : provenance.publishedAt
                      ? formatDate(provenance.publishedAt)
                      : "—"
                }
              />
              <Row
                label="Retrieved by NOXHEIM"
                value={provenance.retrievedAt ? formatDate(provenance.retrievedAt) : "—"}
              />
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {area?.planSourceUrl ? (
                <a
                  href={area.planSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-teal hover:underline"
                >
                  View official plan
                </a>
              ) : null}
              {provenance.sourceUrl ? (
                <a
                  href={provenance.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-teal hover:underline"
                >
                  View dataset source
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Official NUP provenance is not available for this project yet.
          </p>
        )}
      </div>
    </section>
  );
}

function ForecastNeedBlock({ forecasts }: { forecasts: OfficialNupForecastNeed[] }) {
  const sorted = useMemo(
    () => [...forecasts].sort((a, b) => a.year - b.year),
    [forecasts],
  );
  const numericSeries = isNumericMwForecastSeries(sorted);
  const chartData = numericSeries
    ? sorted.map((item) => ({ year: String(item.year), mw: item.valueNumeric as number }))
    : [];

  return (
    <div className="mt-6 border-t border-line pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Forecast transfer-capacity need
      </h3>
      <p className="mt-1 text-sm font-medium text-ink">Forecast need for transfer capacity</p>
      <p className="mt-1 text-sm leading-6 text-muted">
        This is the network company&apos;s published forecast of transfer-capacity need. It does
        not represent available connection capacity or grid headroom.
      </p>
      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Not published</p>
      ) : (
        <>
          {numericSeries ? (
            <div className="mt-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E3E1DD" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#5C6169" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#5C6169" }}
                    width={48}
                    tickFormatter={(value: number) => String(value)}
                  />
                  <RechartsTooltip
                    formatter={(value) => {
                      const numeric = typeof value === "number" ? value : Number(value);
                      return [`${formatMwNumber(numeric)} MW`, "Forecast need"];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mw"
                    stroke="#2A7A6F"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#2A7A6F" }}
                    name="Forecast need"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <ol className="mt-4 divide-y divide-line">
            {sorted.map((item) => (
              <li key={item.year} className="py-2.5">
                <div className="flex items-start justify-between gap-4">
                  <p className="shrink-0 font-mono text-sm">{item.year}</p>
                  <div className="min-w-0 max-w-[78%] text-right">
                    {item.representation === "numeric_mw" && item.valueNumeric != null ? (
                      <p className="text-sm">{formatMwNumber(item.valueNumeric)} MW</p>
                    ) : (
                      <PublishedText
                        label="Published value"
                        value={item.valueText}
                        align="right"
                      />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function FlexibilityBlock({ values }: { values: OfficialNupFlexibilityNeed[] }) {
  const byHorizon = new Map(values.map((item) => [item.horizon ?? "", item]));
  const rows = FLEX_ORDER.map((horizon) => ({
    horizon,
    item: byHorizon.get(horizon) ?? null,
  }));

  return (
    <div className="mt-6 border-t border-line pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Flexibility need
      </h3>
      <p className="mt-1 text-sm leading-6 text-muted">
        Published flexibility-service need by horizon. Units are as stated by the source and are
        not converted.
      </p>
      <dl className="mt-3">
        {rows.map(({ horizon, item }) => {
          const published = nupPublishedAnswerLabel(item?.valueText);
          return (
            <Row
              key={horizon}
              label={nupHorizonLabel(horizon)}
              value={
                published.missing ? (
                  <span className="text-muted">Not published</span>
                ) : (
                  <span className="whitespace-pre-wrap">{published.display}</span>
                )
              }
            />
          );
        })}
      </dl>
    </div>
  );
}

function PublishedAnswerBlock({
  title,
  value,
  context,
}: {
  title: string;
  value: string | null | undefined;
  context?: string;
}) {
  const published = nupPublishedAnswerLabel(value);
  return (
    <div className="mt-6 border-t border-line pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {context ? <p className="mt-1 text-sm leading-6 text-muted">{context}</p> : null}
      <div className="mt-2 text-sm">
        {published.missing ? (
          <p className="text-muted">Not published</p>
        ) : published.mapped ? (
          <p>{published.display}</p>
        ) : (
          <PublishedText value={published.display} />
        )}
      </div>
    </div>
  );
}

function PublishedText({
  value,
  label,
  align = "left",
}: {
  value: string | null | undefined;
  label?: string;
  align?: "left" | "right";
}) {
  const text = (value ?? "").replace(/\r\n/g, "\n").trim();
  const [expanded, setExpanded] = useState(false);
  if (!text) {
    return <p className="text-muted">Not published</p>;
  }
  const long = text.length > LONG_PUBLISHED_VALUE;
  const shown = long && !expanded ? `${text.slice(0, LONG_PUBLISHED_VALUE).trimEnd()}…` : text;
  return (
    <div className={cn(align === "right" && "text-right")}>
      {label ? <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p> : null}
      <p className={cn("whitespace-pre-wrap text-sm leading-6", label && "mt-1")}>{shown}</p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 text-xs font-medium text-teal hover:underline"
        >
          {expanded ? "Show less" : "Show full published value"}
        </button>
      ) : null}
    </div>
  );
}

function formatMwNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function QuietTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
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
