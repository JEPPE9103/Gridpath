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
import { Map as MapLibreMap, Marker, type Map as MapLibreMapType } from "maplibre-gl";
import { useEffect, useRef } from "react";

const SITES = "marketing-sites";
const BOUNDARY = "marketing-boundary";
const COVERING = "marketing-covering";

/** How It Works step ids — optional workflow storytelling on one DiscoveryMap. */
export type DiscoveryWorkflowStage = "search" | "candidates" | "evidence" | "next";

export function DiscoveryMap({
  className,
  size = "hero",
  variant = "discovery",
  selectedSiteId = SAMPLE_SELECTED_CANDIDATE.id,
  showLegend = true,
  workflowStage,
}: {
  className?: string;
  size?: "hero" | "full" | "thumb";
  variant?: "discovery" | "workspace";
  /** Candidate site id to emphasize (e.g. site-a). Defaults to sample Site A. */
  selectedSiteId?: string;
  showLegend?: boolean;
  /** When set, step storytelling controls covering / selection / callouts on this map. */
  workflowStage?: DiscoveryWorkflowStage;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMapType | null>(null);
  const showZones = variant === "discovery";
  const showCoveringBase = variant === "workspace";
  const showRecords = variant === "workspace";

  const emphasizeSiteId = resolveEmphasizedSiteId(workflowStage, selectedSiteId);
  const showCovering =
    showCoveringBase || workflowStage === "candidates";
  const showUnknownCallout = workflowStage === "evidence";
  const showNextCallout = workflowStage === "next";

  // Create map once for this mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    ensureMapLibreWorker();
    const map = new MapLibreMap({
      container,
      style: STYLE,
      center: [SAMPLE_DISCOVERY_CENTER.longitude, SAMPLE_DISCOVERY_CENTER.latitude],
      zoom: 10.6,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
      pixelRatio: Math.min(typeof window === "undefined" ? 2 : window.devicePixelRatio || 1, 2),
    });
    mapRef.current = map;
    const unbindResize = bindMapResize(map, container);
    const markers: Marker[] = [];

    map.on("load", () => {
      map.addSource(COVERING, { type: "geojson", data: SAMPLE_COVERING_GEOJSON });
      map.addLayer({
        id: `${COVERING}-fill`,
        type: "fill",
        source: COVERING,
        layout: { visibility: "none" },
        paint: { "fill-color": LOCAL_NETWORK_FILL, "fill-opacity": 0.11 },
      });
      map.addLayer({
        id: `${COVERING}-line`,
        type: "line",
        source: COVERING,
        layout: { visibility: "none", "line-join": "round", "line-cap": "round" },
        paint: { "line-color": LOCAL_NETWORK_FILL, "line-width": 1.05, "line-opacity": 0.55 },
      });

      map.addSource(BOUNDARY, { type: "geojson", data: SAMPLE_SEARCH_BOUNDARY_GEOJSON });
      map.addLayer({
        id: `${BOUNDARY}-fill`,
        type: "fill",
        source: BOUNDARY,
        paint: { "fill-color": "#1A1E24", "fill-opacity": 0.028 },
      });
      map.addLayer({
        id: `${BOUNDARY}-line`,
        type: "line",
        source: BOUNDARY,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#1A1E24",
          "line-width": 1.2,
          "line-dasharray": [2.2, 1.6],
          "line-opacity": 0.48,
        },
      });

      map.addSource(SITES, { type: "geojson", data: SAMPLE_DISCOVERY_GEOJSON });
      map.addLayer({
        id: `${SITES}-fill`,
        type: "fill",
        source: SITES,
        paint: {
          "fill-antialias": true,
          "fill-color": [
            "case",
            ["==", ["get", "candidateKind"], "zone"],
            "#9AA3AE",
            ["==", ["get", "recommendation"], "prioritise"],
            "#1B6B4A",
            ["==", ["get", "recommendation"], "investigate"],
            "#0F6C8D",
            ["==", ["get", "recommendation"], "secondary"],
            "#B54708",
            "#8B9098",
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "candidateKind"], "zone"],
            0.1,
            0.38,
          ],
        },
      });
      map.addLayer({
        id: `${SITES}-line`,
        type: "line",
        source: SITES,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "candidateKind"], "zone"],
            "#5E6772",
            "#0F2F24",
          ],
          "line-width": ["case", ["==", ["get", "candidateKind"], "zone"], 0.55, 1.05],
          "line-opacity": ["case", ["==", ["get", "candidateKind"], "zone"], 0.28, 0.78],
        },
      });
      map.addLayer({
        id: `${SITES}-selected`,
        type: "line",
        source: SITES,
        filter: ["==", ["get", "id"], ""],
        layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
        paint: { "line-color": "#0B3D2E", "line-width": 2, "line-opacity": 0.92 },
      });

      if (!showZones) {
        map.setFilter(`${SITES}-fill`, ["==", ["get", "candidateKind"], "site"]);
        map.setFilter(`${SITES}-line`, ["==", ["get", "candidateKind"], "site"]);
      }

      if (size === "thumb" && selectedSiteId) {
        // Compare thumbs: one site only — no Search Area, no sibling candidates.
        map.setLayoutProperty(`${BOUNDARY}-fill`, "visibility", "none");
        map.setLayoutProperty(`${BOUNDARY}-line`, "visibility", "none");
        map.setFilter(`${SITES}-fill`, ["==", ["get", "id"], selectedSiteId]);
        map.setFilter(`${SITES}-line`, ["==", ["get", "id"], selectedSiteId]);
        map.setFilter(`${SITES}-selected`, ["==", ["get", "id"], selectedSiteId]);
        map.setLayoutProperty(`${SITES}-selected`, "visibility", "visible");
        map.setPaintProperty(`${SITES}-fill`, "fill-opacity", 0.5);
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
            "background:#1a1e24;color:#fff;font:600 9px/1.2 var(--font-instrument),system-ui,sans-serif;padding:3px 7px;border-radius:999px;white-space:nowrap;letter-spacing:0.01em";
          wrap.appendChild(label);

          const mark = document.createElement("div");
          if (record.kind === "opportunity") {
            mark.style.cssText =
              "width:8px;height:8px;border-radius:2px;background:#2A7A6F;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(26,30,36,0.16)";
          } else {
            mark.style.cssText =
              "width:9px;height:9px;border-radius:999px;background:#176C4A;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(26,30,36,0.16)";
          }
          wrap.appendChild(mark);

          markers.push(
            new Marker({ element: wrap, anchor: "bottom" })
              .setLngLat([record.longitude, record.latitude])
              .addTo(map),
          );
        }
      }

      if (size === "thumb" && selectedSiteId) {
        const center = siteCentroid(selectedSiteId);
        const applyThumbViewport = () => {
          if (!center) return;
          map.resize();
          map.jumpTo({ center, zoom: COMPARE_THUMB_ZOOM });
        };
        applyThumbViewport();
        requestAnimationFrame(() => {
          applyThumbViewport();
        });
      } else if (size === "hero") {
        // Asymmetric padding leaves room for the compact CI card (bottom-right).
        map.fitBounds(
          [
            [SAMPLE_SEARCH_BOUNDS.west, SAMPLE_SEARCH_BOUNDS.south],
            [SAMPLE_SEARCH_BOUNDS.east, SAMPLE_SEARCH_BOUNDS.north],
          ],
          {
            padding: { top: 36, left: 40, bottom: 48, right: 168 },
            duration: 0,
            maxZoom: 11.0,
          },
        );
      } else {
        map.fitBounds(
          [
            [SAMPLE_SEARCH_BOUNDS.west, SAMPLE_SEARCH_BOUNDS.south],
            [SAMPLE_SEARCH_BOUNDS.east, SAMPLE_SEARCH_BOUNDS.north],
          ],
          {
            padding: variant === "workspace" ? 32 : 22,
            duration: 0,
            maxZoom: 11.2,
          },
        );
      }
    });

    return () => {
      unbindResize();
      markers.forEach((marker) => marker.remove());
      mapRef.current = null;
      map.remove();
    };
    // Map instance is created once per mount; stage sync happens below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable map instance
  }, []);

  // Sync covering visibility, site emphasis — without remounting the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (!map.getLayer(`${COVERING}-fill`)) return;

      const coveringVisibility = showCovering ? "visible" : "none";
      map.setLayoutProperty(`${COVERING}-fill`, "visibility", coveringVisibility);
      map.setLayoutProperty(`${COVERING}-line`, "visibility", coveringVisibility);

      if (emphasizeSiteId) {
        map.setPaintProperty(`${SITES}-fill`, "fill-opacity", [
          "case",
          ["==", ["get", "candidateKind"], "zone"],
          0.1,
          ["==", ["get", "id"], emphasizeSiteId],
          0.5,
          workflowStage === "evidence" || workflowStage === "next" ? 0.22 : 0.38,
        ]);
        map.setFilter(`${SITES}-selected`, ["==", ["get", "id"], emphasizeSiteId]);
        map.setLayoutProperty(`${SITES}-selected`, "visibility", "visible");
      } else {
        map.setPaintProperty(`${SITES}-fill`, "fill-opacity", [
          "case",
          ["==", ["get", "candidateKind"], "zone"],
          workflowStage === "candidates" ? 0.14 : 0.1,
          0.38,
        ]);
        map.setLayoutProperty(`${SITES}-selected`, "visibility", "none");
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
    }
  }, [emphasizeSiteId, showCovering, workflowStage]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#e4ebe8]",
        size === "hero" && "h-[320px] sm:h-[340px] lg:h-[400px]",
        size === "full" && "h-[280px] sm:h-[400px] lg:h-[460px]",
        size === "thumb" && "h-[148px] w-full",
        className,
      )}
    >
      <div ref={containerRef} className="h-full w-full [&_.maplibregl-canvas]:outline-none" suppressHydrationWarning />
      {showLegend ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-line/80 bg-surface/90 px-2.5 py-2 text-[10px] leading-4 shadow-[0_10px_24px_-18px_rgba(26,30,36,0.55)] backdrop-blur-[6px]">
          {workflowStage === "candidates" ? (
            <UnderstandLegend />
          ) : variant === "workspace" ? (
            <WorkspaceLegend />
          ) : (
            <DiscoveryLegend />
          )}
        </div>
      ) : null}
      {showUnknownCallout ? <UnknownCallout /> : null}
      {showNextCallout ? <NextCallout /> : null}
    </div>
  );
}

/** Shared zoom for compare thumbs so A/B/C read at the same local scale. */
const COMPARE_THUMB_ZOOM = 13.15;

function resolveEmphasizedSiteId(
  workflowStage: DiscoveryWorkflowStage | undefined,
  selectedSiteId: string,
): string | null {
  if (workflowStage === "search" || workflowStage === "candidates") return null;
  if (workflowStage === "evidence" || workflowStage === "next") {
    return SAMPLE_SELECTED_CANDIDATE.id;
  }
  return selectedSiteId;
}

/** Centroid of one sample candidate polygon — same GeoJSON, no new geometry. */
function siteCentroid(siteId: string): [number, number] | null {
  const feature = SAMPLE_DISCOVERY_GEOJSON.features.find(
    (entry) => entry.properties.id === siteId && entry.properties.candidateKind === "site",
  );
  if (!feature || feature.geometry.type !== "Polygon") return null;

  const ring = feature.geometry.coordinates[0];
  let lngSum = 0;
  let latSum = 0;
  // Exclude closing coordinate duplicate.
  const count = Math.max(ring.length - 1, 1);
  for (let i = 0; i < count; i += 1) {
    lngSum += ring[i][0];
    latSum += ring[i][1];
  }
  return [lngSum / count, latSum / count];
}

function UnknownCallout() {
  const site = SAMPLE_SELECTED_CANDIDATE;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 max-w-[280px] rounded-lg border border-line/80 bg-surface/94 p-3 shadow-[0_14px_28px_-20px_rgba(26,30,36,0.55)] backdrop-blur-[6px] sm:right-auto">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        #{site.rank} {site.name} · Unknown
      </p>
      <p className="mt-1.5 text-[12px] font-medium leading-4 text-ink">{site.topUnknown}</p>
      <p className="mt-1.5 text-[10px] leading-4 text-muted">Not clearance · Unknown ≠ pass</p>
    </div>
  );
}

function NextCallout() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 max-w-[260px] rounded-lg border border-teal/25 bg-surface/94 p-3 shadow-[0_14px_28px_-20px_rgba(26,30,36,0.55)] backdrop-blur-[6px] sm:right-auto">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal">
        Recommended next
      </p>
      <p className="mt-1.5 text-[12px] font-medium leading-4 text-ink">Ground investigation</p>
      <p className="mt-1.5 text-[10px] leading-4 text-muted">
        #{SAMPLE_SELECTED_CANDIDATE.rank} {SAMPLE_SELECTED_CANDIDATE.name}
      </p>
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

function UnderstandLegend() {
  return (
    <>
      <p className="font-medium">Sample evidence</p>
      <LegendDash label="Search Area" />
      <LegendPatch color={LOCAL_NETWORK_FILL} label="Local network · covering" />
      <LegendSwatch color="#176C4A" label="Candidate Site" />
    </>
  );
}

function WorkspaceLegend() {
  return (
    <>
      <p className="font-medium">Sample Map</p>
      <LegendDash label="Search Area" />
      <LegendPatch color={LOCAL_NETWORK_FILL} label="Local network · covering" />
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
