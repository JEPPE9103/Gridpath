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
  let lastWidth = 0;
  let lastHeight = 0;
  let timer = 0;

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    map.resize();
  };

  const debouncedResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(resize, 80);
  };

  map.on("load", resize);
  const frame = requestAnimationFrame(resize);
  const observer = new ResizeObserver(debouncedResize);
  observer.observe(container);

  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    observer.disconnect();
    map.off("load", resize);
  };
}
