"use client";

import { LOCAL_NETWORK_FILL, NUP_FILL } from "@/features/map/map-legend";
import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { markerColor, STYLE } from "@/features/map/mini-map";
import type { MapProject } from "@/lib/data/map-types";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import type { OfficialCoveringGeojson } from "@/lib/data/official-map";
import type {
  OfficialMapAreaPreview,
  OfficialMapCachedViewport,
  OfficialMapFeatureCollection,
  OfficialMapLayer,
  OfficialMapLayerVisibility,
} from "@/lib/domain/official-map";
import {
  OFFICIAL_MAP_OVERVIEW_MAX_ZOOM,
  decideOfficialMapViewportFetch,
  officialMapAreaPreviewFromProperties,
  officialMapBboxContains,
  shouldApplyOfficialMapResponse,
  shouldReplaceOfficialMapSource,
} from "@/lib/domain/official-map";
import {
  getCachedOfficialGeometry,
  officialGeometryCacheKey,
  setCachedOfficialGeometry,
} from "@/lib/map/official-geometry-cache";
import { loadOfficialMapLayerAction } from "@/lib/map/actions";
import { Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource, type MapGeoJSONFeature, type MapMouseEvent } from "maplibre-gl";
import { memo, useEffect, useRef, useState } from "react";

const LOCAL_SOURCE = "official-local-network";
const NUP_SOURCE = "official-nup";
const COVER_SOURCE = "official-covering";
const CHANGE_HIGHLIGHT_SOURCE = "official-change-highlight";

export const SwedenMap = memo(function SwedenMap({
  projects,
  opportunities = [],
  selectedId,
  layers,
  localNetwork,
  planningArea,
  covering,
  highlightAreaId,
  highlightLayer,
  onSelectProject,
  onSelectOpportunity,
  onSelectOfficial,
}: {
  projects: MapProject[];
  opportunities?: OpportunityListItem[];
  selectedId: string | null;
  layers: OfficialMapLayerVisibility;
  localNetwork: OfficialMapFeatureCollection;
  planningArea: OfficialMapFeatureCollection;
  covering: OfficialCoveringGeojson | null;
  highlightAreaId?: string | null;
  highlightLayer?: OfficialMapLayer | null;
  onSelectProject: (slug: string) => void;
  onSelectOpportunity?: (slug: string) => void;
  onSelectOfficial: (input: OfficialMapAreaPreview) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const collectionsRef = useRef({ localNetwork, planningArea });
  const onSelectProjectRef = useRef(onSelectProject);
  const onSelectOpportunityRef = useRef(onSelectOpportunity);
  const onSelectOfficialRef = useRef(onSelectOfficial);
  const markersRef = useRef(new Map<string, Marker>());
  const opportunityMarkersRef = useRef(new Map<string, Marker>());
  const fetchKeyRef = useRef("overview");
  const inFlightKeyRef = useRef<string | null>(null);
  const fetchGenerationRef = useRef(0);
  const cachedViewportRef = useRef<OfficialMapCachedViewport | null>(null);
  const selectedOfficialRef = useRef<{ areaId: string; layer: OfficialMapLayer } | null>(null);
  const lastSelectedMarkerRef = useRef<string | null>(null);
  const lastFittedSlugRef = useRef<string | null>(null);
  const coveringRef = useRef(covering);

  onSelectProjectRef.current = onSelectProject;
  onSelectOpportunityRef.current = onSelectOpportunity;
  onSelectOfficialRef.current = onSelectOfficial;
  coveringRef.current = covering;

  useEffect(() => {
    collectionsRef.current = { localNetwork, planningArea };
  }, [localNetwork, planningArea]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setInitError("Map container was not ready. Refresh the page.");
      return;
    }

    let cancelled = false;
    let map: MapLibreMap | null = null;
    const markers = markersRef.current;
    const opportunityMarkers = opportunityMarkersRef.current;

    try {
      ensureMapLibreWorker();
      map = new MapLibreMap({
        container,
        style: STYLE,
        center: [16.2, 62.2],
        zoom: 4.35,
        minZoom: 3.8,
        maxZoom: 12,
        attributionControl: { compact: true },
        renderWorldCopies: false,
        fadeDuration: 0,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Map failed to start.";
      console.error("SwedenMap failed to initialize", error);
      setInitError(message);
      return;
    }

    if (!map) return;

    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-left");
    const unbindResize = bindMapResize(map, container);
    mapRef.current = map;
    map.once("load", () => {
      if (cancelled || !map) return;
      addOfficialLayers(map);
      setSourceData(map, LOCAL_SOURCE, collectionsRef.current.localNetwork);
      setSourceData(map, NUP_SOURCE, collectionsRef.current.planningArea);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      unbindResize?.();
      markers.forEach((marker) => marker.remove());
      markers.clear();
      opportunityMarkers.forEach((marker) => marker.remove());
      opportunityMarkers.clear();
      try {
        map?.remove();
      } catch {
        // Fast Refresh can detach the container before MapLibre finishes teardown.
      }
      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (fetchKeyRef.current !== "overview") return;
    setSourceData(map, LOCAL_SOURCE, localNetwork);
    setSourceData(map, NUP_SOURCE, planningArea);
  }, [localNetwork, planningArea, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty(
      "official-local-network-fill",
      "visibility",
      layers.localNetwork ? "visible" : "none",
    );
    map.setLayoutProperty(
      "official-local-network-line",
      "visibility",
      layers.localNetwork ? "visible" : "none",
    );
    map.setLayoutProperty(
      "official-nup-fill",
      "visibility",
      layers.planningArea ? "visible" : "none",
    );
    map.setLayoutProperty(
      "official-nup-line",
      "visibility",
      layers.planningArea ? "visible" : "none",
    );
  }, [layers.localNetwork, layers.planningArea, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const features = [covering?.localNetwork, covering?.planningArea].filter(
      (feature): feature is NonNullable<typeof feature> => Boolean(feature?.geometry),
    );
    setSourceData(map, COVER_SOURCE, {
      type: "FeatureCollection",
      features,
      truncated: false,
      featureCount: features.length,
      provenance: null,
    });
  }, [covering, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (highlightAreaId) {
      selectedOfficialRef.current = {
        areaId: highlightAreaId,
        layer:
          highlightLayer ??
          inferOfficialLayer(highlightAreaId, covering, collectionsRef.current),
      };
    } else {
      selectedOfficialRef.current = null;
    }
    applyOfficialSelection(
      map,
      selectedOfficialRef.current,
      coveringRef.current,
      collectionsRef.current,
    );
  }, [highlightAreaId, highlightLayer, covering, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const handleClick = (event: MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(event.point, {
        layers: [
          "official-local-network-fill",
          "official-nup-fill",
          "official-covering-fill",
          "official-local-network-line",
          "official-nup-line",
        ],
      });
      const hit = hits[0];
      const preview = previewFromFeature(hit);
      if (!preview) return;
      selectedOfficialRef.current = { areaId: preview.areaId, layer: preview.layer };
      applyOfficialSelection(
        map,
        selectedOfficialRef.current,
        coveringRef.current,
        collectionsRef.current,
      );
      onSelectOfficialRef.current(preview);
    };
    const interactiveLayers = [
      "official-local-network-fill",
      "official-nup-fill",
      "official-covering-fill",
      "official-local-network-line",
      "official-nup-line",
    ];
    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", handleClick);
    for (const layerId of interactiveLayers) {
      map.on("mouseenter", layerId, onEnter);
      map.on("mouseleave", layerId, onLeave);
    }
    return () => {
      map.off("click", handleClick);
      for (const layerId of interactiveLayers) {
        map.off("mouseenter", layerId, onEnter);
        map.off("mouseleave", layerId, onLeave);
      }
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let timer = 0;

    const restoreOverview = () => {
      if (fetchKeyRef.current === "overview") return;
      fetchKeyRef.current = "overview";
      inFlightKeyRef.current = null;
      cachedViewportRef.current = null;
      setSourceData(map, LOCAL_SOURCE, collectionsRef.current.localNetwork);
      setSourceData(map, NUP_SOURCE, collectionsRef.current.planningArea);
      applyOfficialSelection(
        map,
        selectedOfficialRef.current,
        coveringRef.current,
        collectionsRef.current,
      );
    };

    const visibleBbox = () => {
      const bounds = map.getBounds();
      return {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      };
    };

    const applyLayerCollection = (
      sourceId: string,
      layer: OfficialMapLayer,
      fetchKey: string,
      collection: OfficialMapFeatureCollection,
    ) => {
      if (!shouldReplaceOfficialMapSource(collection)) return;
      setCachedOfficialGeometry(officialGeometryCacheKey(layer, fetchKey), collection);
      setSourceData(map, sourceId, collection);
    };

    const loadViewport = async () => {
      const zoom = map.getZoom();
      const visible = visibleBbox();
      const decision = decideOfficialMapViewportFetch({
        zoom,
        visible,
        cached: cachedViewportRef.current,
      });
      if (decision.action === "overview") {
        restoreOverview();
        return;
      }
      if (decision.action === "keep") return;
      if (decision.key === fetchKeyRef.current || decision.key === inFlightKeyRef.current) return;
      inFlightKeyRef.current = decision.key;
      const generation = (fetchGenerationRef.current += 1);
      const localKey = officialGeometryCacheKey("local_network", decision.key);
      const nupKey = officialGeometryCacheKey("planning_area", decision.key);
      const cachedLocal = getCachedOfficialGeometry(localKey);
      const cachedNup = getCachedOfficialGeometry(nupKey);
      const cachedLocalUsable = cachedLocal && shouldReplaceOfficialMapSource(cachedLocal) ? cachedLocal : null;
      const cachedNupUsable = cachedNup && shouldReplaceOfficialMapSource(cachedNup) ? cachedNup : null;
      if (cachedLocalUsable && cachedNupUsable) {
        fetchKeyRef.current = decision.key;
        inFlightKeyRef.current = null;
        setSourceData(map, LOCAL_SOURCE, cachedLocalUsable);
        setSourceData(map, NUP_SOURCE, cachedNupUsable);
        cachedViewportRef.current = {
          key: decision.key,
          band: decision.band,
          bbox: decision.requestBbox,
        };
        applyOfficialSelection(
          map,
          selectedOfficialRef.current,
          coveringRef.current,
          collectionsRef.current,
        );
        return;
      }
      const [localResult, nupResult] = await Promise.all([
        cachedLocalUsable
          ? Promise.resolve({ ok: true as const, collection: cachedLocalUsable })
          : loadOfficialMapLayerAction({
              layer: "local_network",
              bbox: decision.requestBbox,
              zoom,
            }),
        cachedNupUsable
          ? Promise.resolve({ ok: true as const, collection: cachedNupUsable })
          : loadOfficialMapLayerAction({
              layer: "planning_area",
              bbox: decision.requestBbox,
              zoom,
            }),
      ]);
      if (
        !shouldApplyOfficialMapResponse(generation, fetchGenerationRef.current) ||
        mapRef.current !== map
      ) {
        return;
      }
      inFlightKeyRef.current = null;
      const localOk = localResult.ok && shouldReplaceOfficialMapSource(localResult.collection);
      const nupOk = nupResult.ok && shouldReplaceOfficialMapSource(nupResult.collection);
      if (localOk || nupOk) {
        fetchKeyRef.current = decision.key;
      }
      if (localOk) {
        applyLayerCollection(LOCAL_SOURCE, "local_network", decision.key, localResult.collection);
      }
      if (nupOk) {
        applyLayerCollection(NUP_SOURCE, "planning_area", decision.key, nupResult.collection);
      }
      if (localOk || nupOk) {
        cachedViewportRef.current = {
          key: decision.key,
          band: decision.band,
          bbox: decision.requestBbox,
        };
      }
      applyOfficialSelection(
        map,
        selectedOfficialRef.current,
        coveringRef.current,
        collectionsRef.current,
      );
    };

    const refetch = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadViewport();
      }, 220);
    };

    const onZoom = () => {
      const zoom = map.getZoom();
      if (zoom < OFFICIAL_MAP_OVERVIEW_MAX_ZOOM) {
        restoreOverview();
        return;
      }
      const cached = cachedViewportRef.current;
      if (cached && !officialMapBboxContains(cached.bbox, visibleBbox())) {
        restoreOverview();
      }
    };

    map.on("zoom", onZoom);
    map.on("moveend", refetch);
    return () => {
      window.clearTimeout(timer);
      map.off("zoom", onZoom);
      map.off("moveend", refetch);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!layers.projects) {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      return;
    }

    const nextIds = new Set(projects.map((project) => project.slug));
    markersRef.current.forEach((marker, slug) => {
      if (!nextIds.has(slug)) {
        marker.remove();
        markersRef.current.delete(slug);
      }
    });

    for (const project of projects) {
      const selected = selectedId === project.slug;
      const existing = markersRef.current.get(project.slug);
      if (existing) {
        existing.setLngLat([project.longitude, project.latitude]);
        continue;
      }
      const el = document.createElement("button");
      el.type = "button";
      styleMarkerElement(el, selected, project);
      el.onclick = (event) => {
        event.stopPropagation();
        onSelectProjectRef.current(project.slug);
      };
      markersRef.current.set(
        project.slug,
        new Marker({ element: el }).setLngLat([project.longitude, project.latitude]).addTo(map),
      );
    }

    const previousSelected = lastSelectedMarkerRef.current;
    if (previousSelected && previousSelected !== selectedId) {
      const previousProject = projects.find((project) => project.slug === previousSelected);
      const previousMarker = markersRef.current.get(previousSelected);
      if (previousProject && previousMarker) {
        styleMarkerElement(previousMarker.getElement(), false, previousProject);
      }
    }
    if (selectedId) {
      const selectedProject = projects.find((project) => project.slug === selectedId);
      const selectedMarker = markersRef.current.get(selectedId);
      if (selectedProject && selectedMarker) {
        styleMarkerElement(selectedMarker.getElement(), true, selectedProject);
      }
    }
    lastSelectedMarkerRef.current = selectedId;
  }, [projects, selectedId, mapReady, layers.projects]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const markers = opportunityMarkersRef.current;
    if (!layers.opportunities && !layers.rejectedOpportunities) {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      return;
    }
    const plottable = opportunities.filter((item) => {
      if (item.latitude == null || item.longitude == null) return false;
      if (item.status === "rejected") return layers.rejectedOpportunities;
      return layers.opportunities;
    });
    const nextIds = new Set(plottable.map((item) => item.slug));
    markers.forEach((marker, slug) => {
      if (!nextIds.has(slug)) {
        marker.remove();
        markers.delete(slug);
      }
    });
    for (const item of plottable) {
      const existing = markers.get(item.slug);
      if (existing) {
        existing.setLngLat([item.longitude as number, item.latitude as number]);
        styleOpportunityMarker(existing.getElement(), item);
        continue;
      }
      const el = document.createElement("button");
      el.type = "button";
      styleOpportunityMarker(el, item);
      el.onclick = (event) => {
        event.stopPropagation();
        onSelectOpportunityRef.current?.(item.slug);
      };
      markers.set(
        item.slug,
        new Marker({ element: el }).setLngLat([item.longitude as number, item.latitude as number]).addTo(map),
      );
    }
  }, [opportunities, mapReady, layers.opportunities, layers.rejectedOpportunities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) return;
    if (lastFittedSlugRef.current === selectedId) return;
    const selectedProject = projects.find((project) => project.slug === selectedId);
    if (!selectedProject) return;
    lastFittedSlugRef.current = selectedId;
    const alreadyClose =
      Math.abs(map.getCenter().lng - selectedProject.longitude) < 0.04 &&
      Math.abs(map.getCenter().lat - selectedProject.latitude) < 0.03 &&
      map.getZoom() >= 7.2;
    if (alreadyClose) return;
    map.easeTo({
      center: [selectedProject.longitude, selectedProject.latitude],
      zoom: Math.max(map.getZoom(), 7.2),
      duration: 220,
    });
  }, [selectedId, mapReady, projects]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-[#e4e9ee]" />
      {initError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center text-sm text-muted">
          Could not start the map. Refresh the page. If it continues, restart the local app.
        </div>
      ) : null}
    </div>
  );
});

function addOfficialLayers(map: MapLibreMap) {
  const empty = { type: "FeatureCollection" as const, features: [] as Array<Record<string, unknown>> };
  const source = {
    type: "geojson" as const,
    data: empty as never,
    promoteId: "id",
    tolerance: 1.4,
  };
  map.addSource(LOCAL_SOURCE, { ...source, data: { ...empty } as never });
  map.addSource(NUP_SOURCE, { ...source, data: { ...empty } as never });
  map.addSource(COVER_SOURCE, { ...source, data: { ...empty } as never, tolerance: 0.8 });
  map.addSource(CHANGE_HIGHLIGHT_SOURCE, { ...source, data: { ...empty } as never, tolerance: 0.8 });

  map.addLayer({
    id: "official-nup-fill",
    type: "fill",
    source: NUP_SOURCE,
    paint: {
      "fill-color": NUP_FILL,
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.07, 6, 0.1, 9, 0.16],
    },
  });
  map.addLayer({
    id: "official-nup-line",
    type: "line",
    source: NUP_SOURCE,
    paint: {
      "line-color": NUP_FILL,
      "line-width": ["interpolate", ["linear"], ["zoom"], 3.8, 0.9, 6, 1.15, 9, 1.5],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.7, 6, 0.82],
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "official-local-network-fill",
    type: "fill",
    source: LOCAL_SOURCE,
    paint: {
      "fill-color": LOCAL_NETWORK_FILL,
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.09, 6, 0.12, 9, 0.18],
    },
  });
  map.addLayer({
    id: "official-local-network-line",
    type: "line",
    source: LOCAL_SOURCE,
    paint: {
      "line-color": LOCAL_NETWORK_FILL,
      "line-width": ["interpolate", ["linear"], ["zoom"], 3.8, 1, 6, 1.25, 9, 1.7],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.78, 6, 0.9],
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "official-covering-fill",
    type: "fill",
    source: COVER_SOURCE,
    paint: {
      "fill-color": ["match", ["get", "layer"], "planning_area", NUP_FILL, LOCAL_NETWORK_FILL],
      "fill-opacity": 0.28,
    },
  });
  map.addLayer({
    id: "official-covering-line",
    type: "line",
    source: COVER_SOURCE,
    paint: { "line-color": "#163A34", "line-width": 2.2 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "official-change-highlight-fill",
    type: "fill",
    source: CHANGE_HIGHLIGHT_SOURCE,
    paint: {
      "fill-color": ["match", ["get", "layer"], "planning_area", NUP_FILL, LOCAL_NETWORK_FILL],
      "fill-opacity": 0.12,
    },
  });
  map.addLayer({
    id: "official-change-highlight-line",
    type: "line",
    source: CHANGE_HIGHLIGHT_SOURCE,
    paint: { "line-color": "#163A34", "line-width": 3.4 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
}

function styleOpportunityMarker(el: HTMLElement, item: OpportunityListItem) {
  const rejected = item.status === "rejected";
  const shortlisted = item.status === "shortlisted" || item.status === "strong_candidate";
  el.style.width = shortlisted ? "13px" : "12px";
  el.style.height = shortlisted ? "13px" : "12px";
  el.style.borderRadius = "2px";
  el.style.background = rejected ? "#8A8F98" : shortlisted ? "#163A34" : "#2A7A6F";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 0 0 1px rgba(26,30,36,0.25)";
  el.style.cursor = "pointer";
  el.style.opacity = rejected ? "0.7" : "1";
  el.title = `${item.name} · Opportunity`;
}

function styleMarkerElement(el: HTMLElement, selected: boolean, project: MapProject) {
  el.style.width = selected ? "18px" : "14px";
  el.style.height = selected ? "18px" : "14px";
  el.style.borderRadius = "999px";
  el.style.background = markerColor(project.outlook);
  el.style.border = "2px solid white";
  el.style.boxShadow = selected ? "0 0 0 3px rgba(42,122,111,0.35)" : "0 0 0 1px rgba(26,30,36,0.2)";
  el.style.cursor = "pointer";
  el.style.zIndex = selected ? "2" : "1";
  el.title = project.name;
}

function findHighlightFeature(
  areaId: string | null | undefined,
  covering: OfficialCoveringGeojson | null,
  localNetwork: OfficialMapFeatureCollection,
  planningArea: OfficialMapFeatureCollection,
): OfficialMapFeatureCollection["features"][number] | null {
  if (!areaId) return null;
  const coveringHits = [covering?.localNetwork, covering?.planningArea].filter(
    (feature): feature is NonNullable<typeof feature> => Boolean(feature?.geometry),
  );
  return (
    coveringHits.find((feature) => feature.properties.id === areaId || feature.id === areaId) ??
    localNetwork.features.find((feature) => feature.properties.id === areaId || feature.id === areaId) ??
    planningArea.features.find((feature) => feature.properties.id === areaId || feature.id === areaId) ??
    null
  );
}

function applyOfficialSelection(
  map: MapLibreMap,
  selection: { areaId: string; layer: OfficialMapLayer } | null,
  covering: OfficialCoveringGeojson | null,
  collections: {
    localNetwork: OfficialMapFeatureCollection;
    planningArea: OfficialMapFeatureCollection;
  },
) {
  const highlight = selection
    ? findHighlightFeature(selection.areaId, covering, collections.localNetwork, collections.planningArea)
    : null;
  setSourceData(map, CHANGE_HIGHLIGHT_SOURCE, {
    type: "FeatureCollection",
    features: highlight ? [highlight] : [],
    truncated: false,
    featureCount: highlight ? 1 : 0,
    provenance: null,
  });
}

function previewFromFeature(hit: MapGeoJSONFeature | undefined): OfficialMapAreaPreview | null {
  if (!hit) return null;
  const fallbackLayer: OfficialMapLayer = hit.layer?.id.includes("nup")
    ? "planning_area"
    : "local_network";
  return officialMapAreaPreviewFromProperties(
    hit.properties as Record<string, unknown> | null,
    hit.id,
    fallbackLayer,
  );
}

function inferOfficialLayer(
  areaId: string,
  covering: OfficialCoveringGeojson | null,
  collections: {
    localNetwork: OfficialMapFeatureCollection;
    planningArea: OfficialMapFeatureCollection;
  },
): OfficialMapLayer {
  if (covering?.planningArea?.properties.id === areaId || covering?.planningArea?.id === areaId) {
    return "planning_area";
  }
  if (covering?.localNetwork?.properties.id === areaId || covering?.localNetwork?.id === areaId) {
    return "local_network";
  }
  if (collections.planningArea.features.some((feature) => feature.properties.id === areaId || feature.id === areaId)) {
    return "planning_area";
  }
  return "local_network";
}

function setSourceData(map: MapLibreMap, sourceId: string, collection: OfficialMapFeatureCollection) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: collection.features.flatMap((feature) => {
      if (!feature.geometry) return [];
      return [
        {
          type: "Feature" as const,
          id: feature.id ?? feature.properties.id,
          geometry: feature.geometry as never,
          properties: feature.properties,
        },
      ];
    }),
  });
}
