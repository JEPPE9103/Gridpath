"use client";

import { BellButton } from "@/components/layout/app-shell";
import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatCapacity, formatDate, formatHeaderDate } from "@/lib/format";
import { rankingExplanation, strongestProfile } from "@/lib/ranking";
import { projectRepository } from "@/lib/repositories";
import { useWorkspace } from "@/lib/workspace-state";
import type { Project } from "@/types";
import { markerColor, STYLE } from "@/features/map/mini-map";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function MapPage() {
  const { overlays, compareIds, addToCompare, removeFromCompare, clearCompare } = useWorkspace();
  const projects = useMemo(() => projectRepository.list(overlays), [overlays]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const selected = projects.find((project) => project.id === selectedId);
  const compared = projects.filter((project) => compareIds.includes(project.id));
  const strongest = strongestProfile(compared);

  return (
    <>
      <PageHeader
        title="Map & Compare"
        subtitle="Sweden portfolio sites. Marker colour follows connection outlook."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCompareOpen(true)} disabled={compared.length === 0}>
              Compare ({compared.length}/4)
            </Button>
            <BellButton />
            <span className="text-sm text-muted">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />
      <div className="relative min-h-0 flex-1 px-8 py-4">
        <div className="relative h-[calc(100vh-180px)] min-h-[520px] overflow-hidden rounded-md border border-line bg-surface">
          <SwedenMap projects={projects} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="absolute left-3 top-3 rounded-md border border-line bg-surface px-3 py-2 text-xs">
            <p className="font-medium">Outlook</p>
            <LegendDot color="#176C4A" label="Favourable" />
            <LegendDot color="#B54708" label="Possible" />
            <LegendDot color="#B42318" label="Weak / risk" />
            <LegendDot color="#8B9098" label="Unknown" />
          </div>
          {selected ? (
            <aside className="absolute right-3 top-3 w-[320px] rounded-md border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-sm text-muted">{selected.location}</p>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="text-muted hover:text-ink">
                  <X size={14} />
                </button>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Line label="Technology" value={selected.technology} />
                <Line label="Capacity" value={formatCapacity(selected)} />
                <Line label="Grid operator" value={selected.gridOperator} />
                <Line label="Outlook" value={<OutlookBadge outlook={selected.outlook} />} />
                <Line label="Confidence" value={<ConfidenceBadge confidence={selected.confidence} />} />
                <Line label="Stage" value={<StageBadge stage={selected.stage} />} />
                <Line label="Target COD" value={selected.targetCOD} />
              </dl>
              <div className="mt-4 flex gap-2">
                <Link href={`/projects/${selected.id}`} className="flex-1">
                  <Button className="w-full">Open Project</Button>
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => {
                    addToCompare(selected.id);
                    setCompareOpen(true);
                  }}
                  disabled={compareIds.includes(selected.id)}
                >
                  Add to Compare
                </Button>
              </div>
            </aside>
          ) : null}
        </div>
        <Disclaimer className="mt-3" />
      </div>

      {compareOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between px-8 py-3">
            <div>
              <h2 className="text-base font-semibold">Compare sites ({compared.length}/4)</h2>
              <p className="text-xs text-muted">{rankingExplanation()}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={clearCompare} disabled={compared.length === 0}>
                Clear
              </Button>
              <Button variant="secondary" onClick={() => setCompareOpen(false)}>
                Close
              </Button>
            </div>
          </div>
          {compared.length === 0 ? (
            <p className="px-8 pb-6 text-sm text-muted">
              Select up to four sites from the map to compare development profiles.
            </p>
          ) : (
            <div className="overflow-x-auto px-8 pb-6">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-medium">Field</th>
                    {compared.map((project) => (
                      <th key={project.id} className="py-2 pr-4 font-medium text-ink">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/projects/${project.id}`} className="hover:text-teal">
                            {project.name}
                          </Link>
                          <button type="button" onClick={() => removeFromCompare(project.id)}>
                            <X size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Outlook" values={compared.map((p) => <OutlookBadge key={p.id} outlook={p.outlook} />)} />
                  <CompareRow label="Confidence" values={compared.map((p) => <ConfidenceBadge key={p.id} confidence={p.confidence} />)} />
                  <CompareRow label="Grid operator" values={compared.map((p) => p.gridOperator)} />
                  <CompareRow label="Capacity" values={compared.map((p) => formatCapacity(p))} />
                  <CompareRow label="Connection stage" values={compared.map((p) => p.stage)} />
                  <CompareRow
                    label="Application readiness"
                    values={compared.map((p) => `${p.applicationReadiness.percent}%`)}
                  />
                  <CompareRow label="Known reinforcement" values={compared.map((p) => p.reinforcementInfo)} />
                  <CompareRow
                    label="Known constraints"
                    values={compared.map((p) => p.knownConstraints[0] ?? "None recorded")}
                  />
                  <CompareRow label="Target COD" values={compared.map((p) => p.targetCOD)} />
                  <CompareRow
                    label="Last grid update"
                    values={compared.map((p) => formatDate(p.grid.lastRetrieved))}
                  />
                </tbody>
              </table>
              {strongest ? (
                <div className="mt-4 rounded-md border border-line bg-teal-soft px-4 py-3 text-sm">
                  <p className="font-medium text-teal">Strongest current development profile</p>
                  <p className="mt-1 text-ink">
                    {strongest.name} — NOXHEIM analysis based on outlook, stage, readiness and
                    confidence. Not a guarantee of capacity or operator approval.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function SwedenMap({
  projects,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: STYLE,
      center: [16.2, 62.2],
      zoom: 4.35,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-left");
    mapRef.current = map;
    map.once("load", () => setMapReady(true));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const markers: Marker[] = [];

    for (const project of projects) {
      const el = document.createElement("button");
      el.type = "button";
      el.style.width = selectedId === project.id ? "18px" : "14px";
      el.style.height = selectedId === project.id ? "18px" : "14px";
      el.style.borderRadius = "999px";
      el.style.background = markerColor(project.outlook);
      el.style.border = "2px solid white";
      el.style.boxShadow =
        selectedId === project.id
          ? "0 0 0 3px rgba(42,122,111,0.35)"
          : "0 0 0 1px rgba(26,30,36,0.2)";
      el.style.cursor = "pointer";
      el.title = project.name;
      el.onclick = () => onSelect(project.id);
      markers.push(
        new Marker({ element: el })
          .setLngLat([project.longitude, project.latitude])
          .addTo(map),
      );
    }

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [projects, selectedId, onSelect, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </p>
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

function CompareRow({ label, values }: { label: string; values: ReactNode[] }) {
  return (
    <tr className="border-b border-line align-top">
      <td className={cn("py-2 pr-4 font-medium text-muted")}>{label}</td>
      {values.map((value, index) => (
        <td key={index} className="py-2 pr-4">
          {value}
        </td>
      ))}
    </tr>
  );
}
