"use client";

import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { STYLE } from "@/features/map/mini-map";
import type { OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
import { Map as MapLibreMap, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

const SOURCE = "screening-areas";
const BBOX_SOURCE = "search-bbox";
const SELECTED_SOURCE = "selected-area";

function emptyCollection(geojson: unknown): Parameters<GeoJSONSource["setData"]>[0] {
  if (
    geojson &&
    typeof geojson === "object" &&
    "type" in geojson &&
    (geojson as { type?: string }).type === "FeatureCollection"
  ) {
    return geojson as Parameters<GeoJSONSource["setData"]>[0];
  }
  return { type: "FeatureCollection", features: [] };
}

function bboxCollection(west: number | null, south: number | null, east: number | null, north: number | null) {
  if (west == null || south == null || east == null || north == null) {
    return { type: "FeatureCollection" as const, features: [] };
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { kind: "search-boundary" },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      },
    ],
  };
}

function fillForRecommendation(value: string, excluded: boolean): string {
  if (excluded) return "#D0D3D8";
  if (value === "prioritise") return "#176C4A";
  if (value === "investigate") return "#0F6C8D";
  if (value === "secondary") return "#B54708";
  return "#8B9098";
}

export function ScreeningResultsMap({
  geojson,
  candidates,
  selectedId,
  onSelect,
  west = null,
  south = null,
  east = null,
  north = null,
}: {
  geojson: unknown;
  candidates: OpportunityRunCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  west?: number | null;
  south?: number | null;
  east?: number | null;
  north?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const [showQualifying, setShowQualifying] = useState(true);
  const [showExcluded, setShowExcluded] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showZones, setShowZones] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureMapLibreWorker();
    const first = candidates.find((item) => item.longitude != null && item.latitude != null);
    const map = new MapLibreMap({
      container,
      style: STYLE,
      center: first ? [first.longitude as number, first.latitude as number] : [15.2, 59.3],
      zoom: 8,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const unbind = bindMapResize(map, container);
    mapRef.current = map;
    map.on("load", () => {
      map.addSource(BBOX_SOURCE, { type: "geojson", data: bboxCollection(west, south, east, north) });
      map.addLayer({
        id: `${BBOX_SOURCE}-line`,
        type: "line",
        source: BBOX_SOURCE,
        paint: { "line-color": "#1A1E24", "line-width": 1.4, "line-dasharray": [2, 1] },
      });
      map.addSource(SOURCE, { type: "geojson", data: emptyCollection(geojson) });
      map.addLayer({
        id: `${SOURCE}-fill`,
        type: "fill",
        source: SOURCE,
        filter: ["==", ["get", "candidateKind"], "site"],
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "candidateKind"], "zone"],
            "#C5CCD6",
            ["==", ["get", "excluded"], true],
            "#D0D3D8",
            ["==", ["get", "recommendation"], "prioritise"],
            "#176C4A",
            ["==", ["get", "recommendation"], "investigate"],
            "#0F6C8D",
            ["==", ["get", "recommendation"], "secondary"],
            "#B54708",
            "#8B9098",
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "candidateKind"], "zone"],
            0.16,
            0.45,
          ],
        },
      });
      map.addLayer({
        id: `${SOURCE}-line`,
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "candidateKind"], "site"],
        paint: { "line-color": "#1A1E24", "line-width": 0.8, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: `${SELECTED_SOURCE}-line`,
        type: "line",
        source: SOURCE,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#0B3D2E", "line-width": 2.4 },
      });
      map.on("click", `${SOURCE}-fill`, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });
    });
    return () => {
      unbind();
      map.remove();
      mapRef.current = null;
    };
  }, [candidates, east, geojson, north, south, west]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource(SOURCE)) return;
    (map.getSource(SOURCE) as GeoJSONSource).setData(emptyCollection(geojson));
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource(BBOX_SOURCE)) return;
    (map.getSource(BBOX_SOURCE) as GeoJSONSource).setData(bboxCollection(west, south, east, north));
  }, [east, north, south, west]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(`${SELECTED_SOURCE}-line`)) return;
    map.setFilter(`${SELECTED_SOURCE}-line`, ["==", ["get", "id"], selectedId ?? ""]);
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(`${SOURCE}-fill`)) return;
    if (!showQualifying && !showExcluded && !showZones) {
      map.setFilter(`${SOURCE}-fill`, ["==", ["get", "id"], ""]);
      map.setFilter(`${SOURCE}-line`, ["==", ["get", "id"], ""]);
    } else {
      const clauses: unknown[] = ["any"];
      if (showQualifying) clauses.push(["==", ["get", "candidateKind"], "site"]);
      if (showExcluded) clauses.push(["==", ["get", "excluded"], true]);
      if (showZones) clauses.push(["==", ["get", "candidateKind"], "zone"]);
      map.setFilter(`${SOURCE}-fill`, clauses as never);
      map.setFilter(`${SOURCE}-line`, clauses as never);
    }
    if (map.getLayer(`${BBOX_SOURCE}-line`)) {
      map.setLayoutProperty(`${BBOX_SOURCE}-line`, "visibility", showBoundary ? "visible" : "none");
    }
  }, [showBoundary, showExcluded, showQualifying, showZones]);

  useEffect(() => {
    const selected = candidates.find((item) => item.id === selectedId);
    if (!selected || selected.longitude == null || selected.latitude == null) return;
    mapRef.current?.easeTo({ center: [selected.longitude, selected.latitude], duration: 400 });
  }, [candidates, selectedId]);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="flex flex-wrap gap-3 border-b border-line bg-surface px-3 py-2 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showQualifying} onChange={(event) => setShowQualifying(event.target.checked)} />
          Candidate sites
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showZones} onChange={(event) => setShowZones(event.target.checked)} />
          Opportunity zones
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showExcluded} onChange={(event) => setShowExcluded(event.target.checked)} />
          Excluded
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showBoundary} onChange={(event) => setShowBoundary(event.target.checked)} />
          Search boundary
        </label>
      </div>
      <div ref={containerRef} className="h-80 w-full" />
      <p className="border-t border-line bg-surface px-3 py-2 text-xs text-muted">
        Candidate sites are the primary decision layer. Opportunity zones are the broader remaining
        geography after exclusions — toggle them on to see regional context. Not land parcels.
        {selectedId
          ? ` Selected fill uses ${fillForRecommendation(
              candidates.find((item) => item.id === selectedId)?.recommendation ?? "",
              candidates.find((item) => item.id === selectedId)?.excluded === true,
            )}.`
          : ""}
      </p>
    </div>
  );
}
