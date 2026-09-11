"use client";

import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { STYLE } from "@/features/map/mini-map";
import { cn } from "@/lib/cn";
import {
  SAMPLE_DISCOVERY_CENTER,
  SAMPLE_DISCOVERY_GEOJSON,
  SAMPLE_SEARCH_BOUNDARY_GEOJSON,
  SAMPLE_SEARCH_BOUNDS,
  SAMPLE_SELECTED_CANDIDATE,
} from "@/lib/demo/sample-discovery-preview";
import { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

const SITES = "marketing-sites";
const BOUNDARY = "marketing-boundary";

export function DiscoveryMap({
  className,
  size = "hero",
  showZones = true,
}: {
  className?: string;
  size?: "hero" | "full";
  showZones?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    map.on("load", () => {
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
          "fill-opacity": ["case", ["==", ["get", "candidateKind"], "zone"], 0.22, 0.48],
        },
      });
      map.addLayer({
        id: `${SITES}-line`,
        type: "line",
        source: SITES,
        paint: { "line-color": "#1A1E24", "line-width": 0.8, "line-opacity": 0.7 },
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

      map.fitBounds(
        [
          [SAMPLE_SEARCH_BOUNDS.west, SAMPLE_SEARCH_BOUNDS.south],
          [SAMPLE_SEARCH_BOUNDS.east, SAMPLE_SEARCH_BOUNDS.north],
        ],
        { padding: 28, duration: 0 },
      );
    });

    return () => {
      unbindResize();
      map.remove();
    };
  }, [showZones]);

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
        <p className="font-medium">Sample screening</p>
        <LegendDash label="Search Area" />
        <LegendSwatch color="#C5CCD6" label="Opportunity Zone" />
        <LegendSwatch color="#176C4A" label="Candidate Site" />
      </div>
    </div>
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

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-muted">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </p>
  );
}
