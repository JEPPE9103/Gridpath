import type { Map } from "maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";

let workerConfigured = false;

/** Next.js/Turbopack cannot bundle the MapLibre worker sibling module — serve it from /public. */
export function ensureMapLibreWorker(): void {
  if (workerConfigured || typeof window === "undefined") return;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  workerConfigured = true;
}

export function bindMapResize(map: Map, container: HTMLElement): () => void {
  const resize = () => map.resize();
  map.on("load", resize);
  const frame = requestAnimationFrame(resize);
  const later = window.setTimeout(resize, 300);
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(later);
    observer.disconnect();
    map.off("load", resize);
  };
}
