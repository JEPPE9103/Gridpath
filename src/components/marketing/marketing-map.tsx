"use client";

import { markerColor, STYLE } from "@/features/map/mini-map";
import type { Outlook } from "@/types";
import { Map, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";

export type MarketingMapSite = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  outlook: Outlook;
};

export function MarketingMap({
  sites,
  selectedId,
}: {
  sites: MarketingMapSite[];
  selectedId: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const map = new Map({
      container,
      style: STYLE,
      center: [16.4, 62.05],
      zoom: 4.2,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });

    const markers: Marker[] = [];

    const placeMarkers = () => {
      if (cancelled) return;

      for (const site of sites) {
        const selected = site.id === selectedId;
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column";
        wrap.style.alignItems = "center";
        wrap.style.gap = "5px";
        wrap.style.pointerEvents = "none";

        if (selected) {
          const label = document.createElement("div");
          label.textContent = site.name;
          label.style.cssText =
            "background:#1a1e24;color:#fff;font:600 10px/1.2 var(--font-instrument),system-ui,sans-serif;padding:4px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 8px 18px -12px rgba(26,30,36,0.6)";
          wrap.appendChild(label);
        }

        const dot = document.createElement("div");
        dot.style.width = selected ? "14px" : "11px";
        dot.style.height = selected ? "14px" : "11px";
        dot.style.borderRadius = "999px";
        dot.style.background = markerColor(site.outlook);
        dot.style.border = "2px solid #fff";
        dot.style.boxShadow = selected
          ? "0 0 0 4px rgba(42,122,111,0.3)"
          : "0 0 0 1px rgba(26,30,36,0.16)";
        wrap.appendChild(dot);

        markers.push(
          new Marker({ element: wrap, anchor: "bottom" })
            .setLngLat([site.longitude, site.latitude])
            .addTo(map),
        );
      }
    };

    const resize = () => {
      if (!cancelled) map.resize();
    };

    map.on("load", () => {
      resize();
      placeMarkers();
    });

    const frame = requestAnimationFrame(resize);
    const later = window.setTimeout(resize, 720);
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(later);
      observer.disconnect();
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [selectedId, sites]);

  return (
    <div className="relative h-[340px] overflow-hidden bg-[#e4ebe8]">
      <div ref={containerRef} className="h-full w-full [&_.maplibregl-canvas]:outline-none" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-line bg-surface/95 px-2.5 py-2 text-[10px] leading-4 shadow-[0_8px_20px_-16px_rgba(26,30,36,0.5)]">
        <p className="font-medium">Outlook</p>
        <LegendDot color="#176C4A" label="Favourable" />
        <LegendDot color="#B54708" label="Possible" />
        <LegendDot color="#B42318" label="Weak / risk" />
      </div>
    </div>
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
