"use client";

import { LOCAL_NETWORK_FILL, NUP_FILL } from "@/features/map/map-legend";
import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { markerColor, STYLE } from "@/features/map/mini-map";
import type { MapProject } from "@/lib/data/map-types";
import type { OfficialCoveringGeojson } from "@/lib/data/official-map";
import type {
  OfficialMapFeatureCollection,
  OfficialMapLayer,
  OfficialMapLayerVisibility,
} from "@/lib/domain/official-map";
import {
  OFFICIAL_MAP_OVERVIEW_MAX_ZOOM,
  officialMapViewportFetchKey,
} from "@/lib/domain/official-map";
import { loadOfficialMapLayerAction } from "@/lib/map/actions";
import { Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import { memo, useEffect, useRef, useState } from "react";

const LOCAL_SOURCE = "official-local-network";
const NUP_SOURCE = "official-nup";
const COVER_SOURCE = "official-covering";
const FILL_MIN_ZOOM = 5.6;
const EMPTY_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [] as Array<Record<string, unknown>>,
};

export const SwedenMap = memo(function SwedenMap({
  projects,
  selectedId,
  layers,
  localNetwork,
  planningArea,
  covering,
  onSelectProject,
  onSelectOfficial,
}: {
  projects: MapProject[];
  selectedId: string | null;
  layers: OfficialMapLayerVisibility;
  localNetwork: OfficialMapFeatureCollection;
  planningArea: OfficialMapFeatureCollection;
  covering: OfficialCoveringGeojson | null;
  onSelectProject: (slug: string) => void;
  onSelectOfficial: (input: { areaId: string; layer: OfficialMapLayer }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const collectionsRef = useRef({ localNetwork, planningArea });
  const onSelectProjectRef = useRef(onSelectProject);
  const onSelectOfficialRef = useRef(onSelectOfficial);
  const markersRef = useRef(new Map<string, Marker>());
  const ignoreMoveEndRef = useRef(0);
  const fetchKeyRef = useRef("overview");
  const fetchGenerationRef = useRef(0);
  const lastFittedSlugRef = useRef<string | null>(null);

  onSelectProjectRef.current = onSelectProject;
  onSelectOfficialRef.current = onSelectOfficial;

  useEffect(() => {
    collectionsRef.current = { localNetwork, planningArea };
  }, [localNetwork, planningArea]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    ensureMapLibreWorker();
    const map = new MapLibreMap({
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
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-left");
    const unbindResize = bindMapResize(map, container);
    mapRef.current = map;
    map.once("load", () => {
      addOfficialLayers(map);
      setSourceData(map, LOCAL_SOURCE, collectionsRef.current.localNetwork);
      setSourceData(map, NUP_SOURCE, collectionsRef.current.planningArea);
      setMapReady(true);
    });
    return () => {
      unbindResize();
      const markers = markersRef.current;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
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
      const areaId =
        (typeof hit?.properties?.id === "string" && hit.properties.id) ||
        (typeof hit?.id === "string" ? hit.id : null);
      const layer =
        hit?.properties?.layer === "planning_area"
          ? "planning_area"
          : hit?.properties?.layer === "local_network"
            ? "local_network"
            : hit?.layer?.id.includes("nup")
              ? "planning_area"
              : "local_network";
      if (areaId) {
        onSelectOfficialRef.current({ areaId, layer });
      }
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let timer = 0;

    const restoreOverview = () => {
      if (fetchKeyRef.current === "overview") return;
      fetchKeyRef.current = "overview";
      setSourceData(map, LOCAL_SOURCE, collectionsRef.current.localNetwork);
      setSourceData(map, NUP_SOURCE, collectionsRef.current.planningArea);
    };

    const loadViewport = async () => {
      if (ignoreMoveEndRef.current > 0) return;
      const zoom = map.getZoom();
      if (zoom < OFFICIAL_MAP_OVERVIEW_MAX_ZOOM) {
        restoreOverview();
        return;
      }
      const bounds = map.getBounds();
      const key = officialMapViewportFetchKey({
        zoom,
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });
      if (!key || key === fetchKeyRef.current) return;
      fetchKeyRef.current = key;
      const generation = (fetchGenerationRef.current += 1);
      const bbox = {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      };
      const [localResult, nupResult] = await Promise.all([
        loadOfficialMapLayerAction({ layer: "local_network", bbox, zoom }),
        loadOfficialMapLayerAction({ layer: "planning_area", bbox, zoom }),
      ]);
      if (generation !== fetchGenerationRef.current || mapRef.current !== map) return;
      if (localResult.ok) setSourceData(map, LOCAL_SOURCE, localResult.collection);
      if (nupResult.ok) setSourceData(map, NUP_SOURCE, nupResult.collection);
    };

    const refetch = () => {
      if (ignoreMoveEndRef.current > 0) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadViewport();
      }, 480);
    };

    map.on("moveend", refetch);
    return () => {
      window.clearTimeout(timer);
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
        styleMarkerElement(existing.getElement(), selected, project);
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
  }, [projects, selectedId, mapReady, layers.projects]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) return;
    if (lastFittedSlugRef.current === selectedId) return;
    const selectedProject = projects.find((project) => project.slug === selectedId);
    if (!selectedProject) return;
    lastFittedSlugRef.current = selectedId;
    ignoreMoveEndRef.current += 1;
    map.easeTo({
      center: [selectedProject.longitude, selectedProject.latitude],
      zoom: Math.max(map.getZoom(), 7.2),
      duration: 280,
    });
    map.once("moveend", () => {
      window.setTimeout(() => {
        ignoreMoveEndRef.current = Math.max(0, ignoreMoveEndRef.current - 1);
      }, 400);
    });
  }, [selectedId, mapReady, projects]);

  return <div ref={containerRef} className="h-full w-full" />;
});

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

function addOfficialLayers(map: MapLibreMap) {
  const source = {
    type: "geojson" as const,
    data: EMPTY_COLLECTION as never,
    promoteId: "id",
    tolerance: 1.4,
    buffer: 0,
  };
  map.addSource(LOCAL_SOURCE, source);
  map.addSource(NUP_SOURCE, { ...source });
  map.addSource(COVER_SOURCE, { ...source, tolerance: 0.8 });

  map.addLayer({
    id: "official-nup-fill",
    type: "fill",
    source: NUP_SOURCE,
    minzoom: FILL_MIN_ZOOM,
    paint: {
      "fill-color": NUP_FILL,
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5.6, 0.06, 8, 0.14],
    },
  });
  map.addLayer({
    id: "official-nup-line",
    type: "line",
    source: NUP_SOURCE,
    paint: {
      "line-color": NUP_FILL,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.45, 8, 0.9],
      "line-opacity": 0.7,
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "official-local-network-fill",
    type: "fill",
    source: LOCAL_SOURCE,
    minzoom: FILL_MIN_ZOOM,
    paint: {
      "fill-color": LOCAL_NETWORK_FILL,
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5.6, 0.08, 8, 0.16],
    },
  });
  map.addLayer({
    id: "official-local-network-line",
    type: "line",
    source: LOCAL_SOURCE,
    paint: {
      "line-color": LOCAL_NETWORK_FILL,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 8, 1],
      "line-opacity": 0.85,
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
}

function setSourceData(map: MapLibreMap, sourceId: string, collection: OfficialMapFeatureCollection) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: collection.features.map((feature) => ({
      type: "Feature",
      id: feature.id ?? feature.properties.id,
      geometry: feature.geometry as never,
      properties: feature.properties,
    })),
  });
}
