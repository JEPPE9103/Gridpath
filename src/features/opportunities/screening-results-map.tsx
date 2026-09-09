"use client";

import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { STYLE } from "@/features/map/mini-map";
import type { OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
import { Map as MapLibreMap, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef } from "react";

const SOURCE = "screening-cells";

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
}: {
  geojson: unknown;
  candidates: OpportunityRunCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);

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
      map.addSource(SOURCE, {
        type: "geojson",
        data: emptyCollection(geojson),
      });
      map.addLayer({
        id: `${SOURCE}-fill`,
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": [
            "case",
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
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: `${SOURCE}-line`,
        type: "line",
        source: SOURCE,
        paint: { "line-color": "#1A1E24", "line-width": 0.8, "line-opacity": 0.7 },
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
  }, [candidates, geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource(SOURCE)) return;
    (map.getSource(SOURCE) as GeoJSONSource).setData(emptyCollection(geojson));
  }, [geojson]);

  useEffect(() => {
    const selected = candidates.find((item) => item.id === selectedId);
    if (!selected || selected.longitude == null || selected.latitude == null) return;
    mapRef.current?.easeTo({ center: [selected.longitude, selected.latitude], duration: 400 });
  }, [candidates, selectedId]);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div ref={containerRef} className="h-80 w-full" />
      <p className="border-t border-line bg-surface px-3 py-2 text-xs text-muted">
        Screening areas, not land parcels. Colour is investigation priority from supported evidence.
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
