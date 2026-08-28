"use client";

import { outlookTone } from "@/lib/format";
import type { Outlook } from "@/types";
import { Map, Marker, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

export function markerColor(outlook: Outlook): string {
  const tone = outlookTone(outlook);
  if (tone === "success") return "#176C4A";
  if (tone === "warning") return "#B54708";
  if (tone === "critical") return "#B42318";
  return "#8B9098";
}

export function MiniMap({
  latitude,
  longitude,
  outlook,
}: {
  latitude: number;
  longitude: number;
  outlook: Outlook;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: STYLE,
      center: [longitude, latitude],
      zoom: 8,
      attributionControl: { compact: true },
    });

    const el = document.createElement("div");
    el.style.width = "14px";
    el.style.height = "14px";
    el.style.borderRadius = "999px";
    el.style.background = markerColor(outlook);
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 0 0 1px rgba(26,30,36,0.2)";

    new Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);

    return () => map.remove();
  }, [latitude, longitude, outlook]);

  return <div ref={containerRef} className="h-56 w-full" />;
}

export { STYLE };
