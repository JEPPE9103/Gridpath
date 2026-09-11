"use client";

import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { STYLE } from "@/features/map/mini-map";
import {
  SWEDEN_EAST,
  SWEDEN_NORTH,
  SWEDEN_SOUTH,
  SWEDEN_WEST,
  bboxAreaKm2,
  bboxFromCorners,
  formatBboxCoordinate,
} from "@/lib/opportunities/spatial-screening";
import { Map as MapLibreMap, NavigationControl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

const SOURCE_ID = "search-area-box";
const FILL_ID = "search-area-fill";
const LINE_ID = "search-area-line";

type LngLat = { lng: number; lat: number };

function rectangleCollection(west: number, south: number, east: number, north: number) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
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

export function SearchAreaPicker({
  west,
  south,
  east,
  north,
  onChange,
}: {
  west: string;
  south: string;
  east: string;
  north: string;
  onChange: (next: { west: string; south: string; east: string; north: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const dragRef = useRef<{ start: LngLat } | null>(null);
  const drawingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  const parsed = {
    west: Number(west),
    south: Number(south),
    east: Number(east),
    north: Number(north),
  };
  const hasBox =
    Number.isFinite(parsed.west) &&
    Number.isFinite(parsed.south) &&
    Number.isFinite(parsed.east) &&
    Number.isFinite(parsed.north) &&
    parsed.west < parsed.east &&
    parsed.south < parsed.north;
  const areaKm2 = hasBox ? bboxAreaKm2(parsed) : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    ensureMapLibreWorker();
    const map = new MapLibreMap({
      container,
      style: STYLE,
      center: [15.5, 62.2],
      zoom: 3.6,
      attributionControl: { compact: true },
      maxBounds: [
        [SWEDEN_WEST - 2, SWEDEN_SOUTH - 1],
        [SWEDEN_EAST + 2, SWEDEN_NORTH + 1],
      ],
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const unbindResize = bindMapResize(map, container);
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(SOURCE_ID, { type: "geojson", data: rectangleCollection(0, 0, 0, 0) });
      map.addLayer({
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#2a7a6f", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: LINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#2a7a6f", "line-width": 1.5 },
      });
    });

    function onDown(event: MapMouseEvent) {
      if (!drawingRef.current) return;
      event.preventDefault();
      map.dragPan.disable();
      dragRef.current = { start: event.lngLat };
    }

    function onMove(event: MapMouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const box = bboxFromCorners(drag.start, event.lngLat);
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(rectangleCollection(box.west, box.south, box.east, box.north));
    }

    function onUp(event: MapMouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      map.dragPan.enable();
      const box = bboxFromCorners(drag.start, event.lngLat);
      onChangeRef.current({
        west: formatBboxCoordinate(box.west),
        south: formatBboxCoordinate(box.south),
        east: formatBboxCoordinate(box.east),
        north: formatBboxCoordinate(box.north),
      });
      drawingRef.current = false;
      setDrawing(false);
      map.getCanvas().style.cursor = "";
    }

    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);

    return () => {
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      unbindResize();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !hasBox) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(rectangleCollection(parsed.west, parsed.south, parsed.east, parsed.north));
  }, [hasBox, parsed.east, parsed.north, parsed.south, parsed.west]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    if (drawing) {
      map.dragPan.disable();
    } else if (!dragRef.current) {
      map.dragPan.enable();
    }
  }, [drawing]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawing((current) => !current)}
          className="h-9 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas"
        >
          {drawing ? "Drag on the map to draw" : "Select area on map"}
        </button>
        {hasBox ? (
          <p className="text-xs text-muted">
            Rectangular envelope
            {areaKm2 != null ? ` · ${Math.round(areaKm2).toLocaleString("en-GB")} km²` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted">Draw a rectangle. Not a municipality or cadastral polygon.</p>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-[#e0e4e8]">
        <div ref={containerRef} className="h-64 w-full [&_.maplibregl-canvas]:outline-none" />
      </div>
    </div>
  );
}
