"use client";

import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { LOCAL_NETWORK_FILL } from "@/features/map/map-legend";
import { STYLE } from "@/features/map/mini-map";
import { cn } from "@/lib/cn";
import {
  SAMPLE_COVERING_GEOJSON,
  SAMPLE_DISCOVERY_CENTER,
  SAMPLE_DISCOVERY_GEOJSON,
  SAMPLE_MAP_RECORDS,
  SAMPLE_SEARCH_BOUNDARY_GEOJSON,
  SAMPLE_SEARCH_BOUNDS,
  SAMPLE_SELECTED_CANDIDATE,
} from "@/lib/demo/sample-discovery-preview";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";

const SITES = "marketing-sites";
const BOUNDARY = "marketing-boundary";
const COVERING = "marketing-covering";

export function DiscoveryMap({
  className,
  size = "hero",
  variant = "discovery",
}: {
  className?: string;
  size?: "hero" | "full";
  variant?: "discovery" | "workspace";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const showZones = variant === "discovery";
  const showCovering = variant === "workspace";
  const showRecords = variant === "workspace";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    ensureMapLibreWorker();
    const map = new MapLibreMap({
      container,
      style: STYLE,
      center: [SAMPLE_DISCOVERY_CENTER.longitude, SAMPLE_DISCOVERY_CENTER.latitude],
      zoom: 10.35,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });
    const unbindResize = bindMapResize(map, container);
    const markers: Marker[] = [];

    map.on("load", () => {
      if (showCovering) {
        map.addSource(COVERING, { type: "geojson", data: SAMPLE_COVERING_GEOJSON });
        map.addLayer({
          id: `${COVERING}-fill`,
          type: "fill",
          source: COVERING,
          paint: { "fill-color": LOCAL_NETWORK_FILL, "fill-opacity": 0.16 },
        });
        map.addLayer({
          id: `${COVERING}-line`,
          type: "line",
          source: COVERING,
          paint: { "line-color": LOCAL_NETWORK_FILL, "line-width": 1.1, "line-opacity": 0.7 },
        });
      }

      map.addSource(BOUNDARY, { type: "geojson", data: SAMPLE_SEARCH_BOUNDARY_GEOJSON });
      map.addLayer({
        id: `${BOUNDARY}-line`,
        type: "line",
        source: BOUNDARY,
        paint: { "line-color": "#1A1E24", "line-width": 1.5, "line-dasharray": [2, 1] },
      });

      map.addSource(SITES, { type: "geojson", data: SAMPLE_DISCOVERY_GEOJSON });
      map.addLayer({
        id: `${SITES}-fill`,
        type: "fill",
        source: SITES,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "candidateKind"], "zone"],
            "#C5CCD6",
            ["==", ["get", "recommendation"], "prioritise"],
            "#176C4A",
            ["==", ["get", "recommendation"], "investigate"],
            "#0F6C8D",
            ["==", ["get", "recommendation"], "secondary"],
            "#B54708",
            "#8B9098",
          ],
          "fill-opacity": ["case", ["==", ["get", "candidateKind"], "zone"], 0.1, 0.58],
        },
      });
      map.addLayer({
        id: `${SITES}-line`,
        type: "line",
        source: SITES,
        paint: {
          "line-color": "#1A1E24",
          "line-width": ["case", ["==", ["get", "candidateKind"], "zone"], 0.4, 0.9],
          "line-opacity": ["case", ["==", ["get", "candidateKind"], "zone"], 0.28, 0.75],
        },
      });
      map.addLayer({
        id: `${SITES}-selected`,
        type: "line",
        source: SITES,
        filter: ["==", ["get", "id"], SAMPLE_SELECTED_CANDIDATE.id],
        paint: { "line-color": "#0B3D2E", "line-width": 2.4 },
      });

      if (!showZones) {
        map.setFilter(`${SITES}-fill`, ["==", ["get", "candidateKind"], "site"]);
        map.setFilter(`${SITES}-line`, ["==", ["get", "candidateKind"], "site"]);
      }

      if (showRecords) {
        for (const record of SAMPLE_MAP_RECORDS) {
          const wrap = document.createElement("div");
          wrap.style.pointerEvents = "none";
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "center";
          wrap.style.gap = "3px";

          const label = document.createElement("div");
          label.textContent = record.name;
          label.style.cssText =
            "background:#1a1e24;color:#fff;font:600 9px/1.2 var(--font-instrument),system-ui,sans-serif;padding:3px 6px;border-radius:4px;white-space:nowrap";
          wrap.appendChild(label);

          const mark = document.createElement("div");
          if (record.kind === "opportunity") {
            mark.style.cssText =
              "width:9px;height:9px;background:#2A7A6F;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(26,30,36,0.2)";
          } else {
            mark.style.cssText =
              "width:10px;height:10px;border-radius:999px;background:#176C4A;border:2px solid #fff;box-shadow:0 0 0 1px rgba(26,30,36,0.2)";
          }
          wrap.appendChild(mark);

          markers.push(
            new Marker({ element: wrap, anchor: "bottom" })
              .setLngLat([record.longitude, record.latitude])
              .addTo(map),
          );
        }
      }

      map.fitBounds(
        [
          [SAMPLE_SEARCH_BOUNDS.west, SAMPLE_SEARCH_BOUNDS.south],
          [SAMPLE_SEARCH_BOUNDS.east, SAMPLE_SEARCH_BOUNDS.north],
        ],
        { padding: variant === "workspace" ? 36 : 28, duration: 0 },
      );
    });

    return () => {
      unbindResize();
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [showCovering, showRecords, showZones, variant]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#e4ebe8]",
        size === "hero" && "h-[220px] sm:h-[280px] lg:h-[320px]",
        size === "full" && "h-[280px] sm:h-[400px] lg:h-[460px]",
        className,
      )}
    >
      <div ref={containerRef} className="h-full w-full [&_.maplibregl-canvas]:outline-none" suppressHydrationWarning />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-surface/95 px-2.5 py-2 text-[10px] leading-4 shadow-[0_8px_20px_-16px_rgba(26,30,36,0.5)]">
        {variant === "workspace" ? <WorkspaceLegend /> : <DiscoveryLegend />}
      </div>
    </div>
  );
}

function DiscoveryLegend() {
  return (
    <>
      <p className="font-medium">Sample screening</p>
      <LegendDash label="Search Area" />
      <LegendSwatch color="#C5CCD6" label="Opportunity Zone" faded />
      <LegendSwatch color="#176C4A" label="Candidate Site" />
    </>
  );
}

function WorkspaceLegend() {
  return (
    <>
      <p className="font-medium">Sample Map</p>
      <LegendDash label="Search Area" />
      <LegendPatch color={LOCAL_NETWORK_FILL} label="Local network area · Ei" />
      <LegendSwatch color="#176C4A" label="Candidate Site" />
      <LegendSwatch color="#2A7A6F" label="Opportunity" />
      <LegendDot color="#176C4A" label="Project" />
    </>
  );
}

function LegendDash({ label }: { label: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-muted">
      <span className="h-px w-3 border-t border-dashed border-ink" />
      {label}
    </p>
  );
}

function LegendSwatch({ color, label, faded = false }: { color: string; label: string; faded?: boolean }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-muted">
      <span
        className="h-2 w-2 rounded-[2px]"
        style={{ background: color, opacity: faded ? 0.45 : 1 }}
      />
      {label}
    </p>
  );
}

function LegendPatch({ color, label }: { color: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-muted">
      <span
        className="h-2 w-3.5 rounded-[2px]"
        style={{ background: `${color}33`, boxShadow: `inset 0 0 0 1px ${color}` }}
      />
      {label}
    </p>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </p>
  );
}
