"use client";

import { LOCAL_NETWORK_FILL, NUP_FILL } from "@/features/map/map-legend";
import { bindMapResize, ensureMapLibreWorker } from "@/features/map/maplibre-setup";
import { STYLE } from "@/features/map/mini-map";
import type { MapProject } from "@/lib/data/map-types";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import type { OfficialCoveringGeojson } from "@/lib/data/official-map";
import {
  EMPTY_DISCOVERY_GEOJSON,
  isPromotedMapOpportunity,
  opportunityFootprintFilter,
  screeningLayerFilter,
  searchAreaBboxCollection,
  type MapGeoJsonFeatureCollection,
  type MapSearchArea,
} from "@/lib/domain/map-discovery";
import { outlookTone } from "@/lib/format";
import type { Outlook } from "@/types";
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
import { Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource, type MapGeoJSONFeature, type MapMouseEvent, type PointLike } from "maplibre-gl";
import { memo, useEffect, useRef, useState } from "react";

const LOCAL_SOURCE = "official-local-network";
const NUP_SOURCE = "official-nup";
const COVER_SOURCE = "official-covering";
const CHANGE_HIGHLIGHT_SOURCE = "official-change-highlight";
const ZONES_SOURCE = "map-opportunity-zones";
const SEARCH_AREA_SOURCE = "map-search-area";
const CANDIDATES_SOURCE = "map-candidates";
const OPP_FOOTPRINT_SOURCE = "map-opportunity-footprints";
const DEVELOPMENT_FILL_LAYERS = ["map-candidates-fill", "map-opportunity-footprints-fill"] as const;

export const SwedenMap = memo(function SwedenMap({
  projects,
  opportunities = [],
  selectedId,
  selectedOpportunitySlug = null,
  selectedCandidateId = null,
  layers,
  localNetwork,
  planningArea,
  covering,
  highlightAreaId,
  highlightLayer,
  discoveryGeojson = EMPTY_DISCOVERY_GEOJSON,
  searchArea = null,
  opportunityFootprints = EMPTY_DISCOVERY_GEOJSON,
  discoveryFitKey = null,
  discoveryLoading = false,
  fitPadding = 56,
  onSelectProject,
  onSelectOpportunity,
  onSelectCandidate,
  onSelectOfficial,
}: {
  projects: MapProject[];
  opportunities?: OpportunityListItem[];
  selectedId: string | null;
  selectedOpportunitySlug?: string | null;
  selectedCandidateId?: string | null;
  layers: OfficialMapLayerVisibility;
  localNetwork: OfficialMapFeatureCollection;
  planningArea: OfficialMapFeatureCollection;
  covering: OfficialCoveringGeojson | null;
  highlightAreaId?: string | null;
  highlightLayer?: OfficialMapLayer | null;
  discoveryGeojson?: MapGeoJsonFeatureCollection;
  searchArea?: MapSearchArea | null;
  opportunityFootprints?: MapGeoJsonFeatureCollection;
  discoveryFitKey?: string | null;
  discoveryLoading?: boolean;
  fitPadding?: number | { top: number; right: number; bottom: number; left: number };
  onSelectProject: (slug: string) => void;
  onSelectOpportunity?: (slug: string) => void;
  onSelectCandidate?: (id: string) => void;
  onSelectOfficial: (input: OfficialMapAreaPreview) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const collectionsRef = useRef({ localNetwork, planningArea });
  const onSelectProjectRef = useRef(onSelectProject);
  const onSelectOpportunityRef = useRef(onSelectOpportunity);
  const onSelectCandidateRef = useRef(onSelectCandidate);
  const onSelectOfficialRef = useRef(onSelectOfficial);
  const lastDiscoveryFitRef = useRef<string | null>(null);
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
  onSelectCandidateRef.current = onSelectCandidate;
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
      addMapLayers(map);
      setSourceData(map, LOCAL_SOURCE, collectionsRef.current.localNetwork);
      setSourceData(map, NUP_SOURCE, collectionsRef.current.planningArea);
      map.resize();
      setMapReady(true);
      window.setTimeout(() => {
        if (mapRef.current === map) map.resize();
      }, 80);
      window.setTimeout(() => {
        if (mapRef.current === map) map.resize();
      }, 320);
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
    if (map.getLayer("map-search-area-line")) {
      map.setLayoutProperty(
        "map-search-area-line",
        "visibility",
        layers.searchAreas && searchArea ? "visible" : "none",
      );
    }
    const siteFilter = screeningLayerFilter(layers.candidateSites, false);
    const zoneFilter = screeningLayerFilter(false, layers.opportunityZones);
    if (map.getLayer("map-zones-fill")) {
      map.setFilter("map-zones-fill", zoneFilter as never);
      map.setFilter("map-zones-line", zoneFilter as never);
    }
    if (map.getLayer("map-candidates-fill")) {
      map.setFilter("map-candidates-fill", siteFilter as never);
      map.setFilter("map-candidates-line", siteFilter as never);
    }
    if (map.getLayer("map-opportunity-footprints-fill")) {
      const footprintFilter = opportunityFootprintFilter(
        layers.opportunities,
        layers.rejectedOpportunities,
      );
      map.setFilter("map-opportunity-footprints-fill", footprintFilter as never);
      map.setFilter("map-opportunity-footprints-line", footprintFilter as never);
    }
    if (map.getLayer("map-candidates-selected")) {
      map.setLayoutProperty(
        "map-candidates-selected",
        "visibility",
        layers.candidateSites ? "visible" : "none",
      );
    }
  }, [
    layers.localNetwork,
    layers.planningArea,
    layers.searchAreas,
    layers.candidateSites,
    layers.opportunityZones,
    layers.opportunities,
    layers.rejectedOpportunities,
    searchArea,
    mapReady,
  ]);

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
    setDiscoverySourceData(map, CANDIDATES_SOURCE, discoveryGeojson);
    setDiscoverySourceData(map, ZONES_SOURCE, discoveryGeojson);
  }, [discoveryGeojson, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setDiscoverySourceData(map, SEARCH_AREA_SOURCE, searchAreaBboxCollection(searchArea));
  }, [searchArea, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setDiscoverySourceData(map, OPP_FOOTPRINT_SOURCE, opportunityFootprints);
  }, [opportunityFootprints, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("map-candidates-selected")) return;
    map.setFilter("map-candidates-selected", ["==", ["get", "id"], selectedCandidateId ?? ""]);
  }, [selectedCandidateId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("map-opportunity-footprints-selected")) return;
    map.setFilter("map-opportunity-footprints-selected", [
      "==",
      ["get", "slug"],
      selectedOpportunitySlug ?? "",
    ]);
  }, [selectedOpportunitySlug, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!discoveryFitKey || !searchArea) return;
    if (lastDiscoveryFitRef.current === discoveryFitKey) return;
    lastDiscoveryFitRef.current = discoveryFitKey;
    map.fitBounds(
      [
        [searchArea.west, searchArea.south],
        [searchArea.east, searchArea.north],
      ],
      { padding: fitPadding, maxZoom: 10, duration: 280 },
    );
  }, [discoveryFitKey, searchArea, mapReady, fitPadding]);

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
    const existingDevelopment = DEVELOPMENT_FILL_LAYERS.filter((id) => map.getLayer(id));
    const pad = 5;
    const hitBox: [PointLike, PointLike] = [
      [event.point.x - pad, event.point.y - pad],
      [event.point.x + pad, event.point.y + pad],
    ];
    const developmentHits = existingDevelopment.length
      ? map.queryRenderedFeatures(hitBox, { layers: [...existingDevelopment] })
      : [];
      const development = developmentHits[0];
      if (development?.layer?.id === "map-candidates-fill") {
        const id = development.properties?.id;
        if (typeof id === "string") {
          onSelectCandidateRef.current?.(id);
          return;
        }
      }
      if (development?.layer?.id === "map-opportunity-footprints-fill") {
        const slug = development.properties?.slug;
        if (typeof slug === "string") {
          onSelectOpportunityRef.current?.(slug);
          return;
        }
      }
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
      "map-candidates-fill",
      "map-opportunity-footprints-fill",
      "official-local-network-fill",
      "official-nup-fill",
      "official-covering-fill",
      "official-local-network-line",
      "official-nup-line",
    ];
    const hoverLayers = ["map-candidates-fill", "map-opportunity-footprints-fill"];
    let hovered: { source: string; id: string | number } | null = null;
    const clearHover = () => {
      if (!hovered) return;
      try {
        map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
      } catch {
        // Source may have been replaced during a viewport fetch.
      }
      hovered = null;
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      clearHover();
    };
    const onHoverMove = (event: MapMouseEvent) => {
      const existing = hoverLayers.filter((id) => map.getLayer(id));
      const hits = existing.length ? map.queryRenderedFeatures(
        [
          [event.point.x - 4, event.point.y - 4],
          [event.point.x + 4, event.point.y + 4],
        ],
        { layers: existing },
      ) : [];
      const hit = hits[0];
      const nextId = hit?.id;
      const nextSource = typeof hit?.source === "string" ? hit.source : null;
      if (hovered && (nextId == null || !nextSource || hovered.id !== nextId || hovered.source !== nextSource)) {
        clearHover();
      }
      if (hit && nextId != null && nextSource) {
        hovered = { source: nextSource, id: nextId };
        map.setFeatureState({ source: nextSource, id: nextId }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
      }
    };
    map.on("click", handleClick);
    map.on("mousemove", onHoverMove);
    for (const layerId of interactiveLayers) {
      map.on("mouseenter", layerId, onEnter);
      map.on("mouseleave", layerId, onLeave);
    }
    return () => {
      map.off("click", handleClick);
      map.off("mousemove", onHoverMove);
      for (const layerId of interactiveLayers) {
        map.off("mouseenter", layerId, onEnter);
        map.off("mouseleave", layerId, onLeave);
      }
      clearHover();
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
      if (isPromotedMapOpportunity(item)) return false;
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
      const zoom = map.getZoom();
      if (existing) {
        existing.setLngLat([item.longitude as number, item.latitude as number]);
        styleOpportunityMarker(existing.getElement(), item, selectedOpportunitySlug === item.slug, zoom);
        continue;
      }
      const el = document.createElement("button");
      el.type = "button";
      styleOpportunityMarker(el, item, selectedOpportunitySlug === item.slug, zoom);
      el.onclick = (event) => {
        event.stopPropagation();
        onSelectOpportunityRef.current?.(item.slug);
      };
      markers.set(
        item.slug,
        new Marker({ element: el }).setLngLat([item.longitude as number, item.latitude as number]).addTo(map),
      );
    }
  }, [opportunities, mapReady, layers.opportunities, layers.rejectedOpportunities, selectedOpportunitySlug]);

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
      duration: 240,
    });
  }, [selectedId, mapReady, projects]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const restyle = () => {
      const zoom = map.getZoom();
      for (const item of opportunities) {
        const marker = opportunityMarkersRef.current.get(item.slug);
        if (!marker) continue;
        styleOpportunityMarker(
          marker.getElement(),
          item,
          selectedOpportunitySlug === item.slug,
          zoom,
        );
      }
    };
    restyle();
    map.on("zoomend", restyle);
    return () => {
      map.off("zoomend", restyle);
    };
  }, [mapReady, opportunities, selectedOpportunitySlug]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-[#e4e9ee]" data-testid="map-canvas" />
      {discoveryLoading ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-line bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-sm">
          Loading selected screening run…
        </div>
      ) : null}
      {initError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center text-sm text-muted">
          Could not start the map. Refresh the page. If it continues, restart the local app.
        </div>
      ) : null}
    </div>
  );
});

function addMapLayers(map: MapLibreMap) {
  const empty = { type: "FeatureCollection" as const, features: [] as Array<Record<string, unknown>> };
  const source = {
    type: "geojson" as const,
    data: empty as never,
    promoteId: "id",
    tolerance: 1.4,
  };
  map.addSource(ZONES_SOURCE, { ...source, data: { ...empty } as never, promoteId: "id" });
  map.addSource(LOCAL_SOURCE, { ...source, data: { ...empty } as never });
  map.addSource(NUP_SOURCE, { ...source, data: { ...empty } as never });
  map.addSource(SEARCH_AREA_SOURCE, { ...source, data: { ...empty } as never, tolerance: 0.4 });
  map.addSource(CANDIDATES_SOURCE, { ...source, data: { ...empty } as never, tolerance: 0.4 });
  map.addSource(OPP_FOOTPRINT_SOURCE, { ...source, data: { ...empty } as never, tolerance: 0.4 });
  map.addSource(COVER_SOURCE, { ...source, data: { ...empty } as never, tolerance: 0.8 });
  map.addSource(CHANGE_HIGHLIGHT_SOURCE, { ...source, data: { ...empty } as never, tolerance: 0.8 });

  map.addLayer({
    id: "map-zones-fill",
    type: "fill",
    source: ZONES_SOURCE,
    filter: ["==", ["get", "candidateKind"], "zone"],
    layout: { visibility: "none" },
    paint: { "fill-color": "#C5CCD6", "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "map-zones-line",
    type: "line",
    source: ZONES_SOURCE,
    filter: ["==", ["get", "candidateKind"], "zone"],
    layout: { visibility: "none", "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#8A8F98", "line-width": 0.6, "line-opacity": 0.35 },
  });
  map.addLayer({
    id: "official-nup-fill",
    type: "fill",
    source: NUP_SOURCE,
    paint: {
      "fill-color": NUP_FILL,
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.02, 6, 0.035, 9, 0.055],
    },
  });
  map.addLayer({
    id: "official-nup-line",
    type: "line",
    source: NUP_SOURCE,
    paint: {
      "line-color": NUP_FILL,
      "line-width": ["interpolate", ["linear"], ["zoom"], 3.8, 0.7, 6, 1.05, 9, 1.35],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.42, 6, 0.55],
      "line-dasharray": [2.4, 1.6],
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "official-local-network-fill",
    type: "fill",
    source: LOCAL_SOURCE,
    paint: {
      "fill-color": LOCAL_NETWORK_FILL,
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.025, 6, 0.045, 9, 0.07],
    },
  });
  map.addLayer({
    id: "official-local-network-line",
    type: "line",
    source: LOCAL_SOURCE,
    paint: {
      "line-color": LOCAL_NETWORK_FILL,
      "line-width": ["interpolate", ["linear"], ["zoom"], 3.8, 0.55, 6, 0.8, 9, 1.05],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 3.8, 0.38, 6, 0.5],
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "map-search-area-line",
    type: "line",
    source: SEARCH_AREA_SOURCE,
    paint: { "line-color": "#1A1E24", "line-width": 1.05, "line-dasharray": [2.2, 1.8], "line-opacity": 0.48 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "map-candidates-fill",
    type: "fill",
    source: CANDIDATES_SOURCE,
    filter: ["==", ["get", "candidateKind"], "site"],
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
      "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.7, 0.52],
    },
  });
  map.addLayer({
    id: "map-candidates-line",
    type: "line",
    source: CANDIDATES_SOURCE,
    filter: ["==", ["get", "candidateKind"], "site"],
    paint: {
      "line-color": "#1A1E24",
      "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.35, 0.95],
      "line-opacity": 0.78,
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "map-opportunity-footprints-fill",
    type: "fill",
    source: OPP_FOOTPRINT_SOURCE,
    paint: {
      "fill-color": [
        "match",
        ["get", "footprintStyle"],
        "shortlisted",
        "#163A34",
        "rejected",
        "#8A8F98",
        "#2A7A6F",
      ],
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        ["interpolate", ["linear"], ["zoom"], 5, 0.16, 8.5, 0.34, 11, 0.4],
        [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          ["match", ["get", "footprintStyle"], "rejected", 0.05, 0.07],
          8.5,
          ["match", ["get", "footprintStyle"], "rejected", 0.1, "shortlisted", 0.26, 0.2],
          11,
          ["match", ["get", "footprintStyle"], "rejected", 0.14, "shortlisted", 0.34, 0.28],
        ],
      ],
    },
  });
  map.addLayer({
    id: "map-opportunity-footprints-line",
    type: "line",
    source: OPP_FOOTPRINT_SOURCE,
    paint: {
      "line-color": [
        "match",
        ["get", "footprintStyle"],
        "shortlisted",
        "#163A34",
        "rejected",
        "#8A8F98",
        "#2A7A6F",
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        ["match", ["get", "footprintStyle"], "shortlisted", 0.7, "rejected", 0.5, 0.6],
        8.5,
        ["match", ["get", "footprintStyle"], "shortlisted", 1.7, "rejected", 0.9, 1.35],
      ],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 8.5, 0.85],
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "official-covering-fill",
    type: "fill",
    source: COVER_SOURCE,
    paint: {
      "fill-color": ["match", ["get", "layer"], "planning_area", NUP_FILL, LOCAL_NETWORK_FILL],
      "fill-opacity": 0.16,
    },
  });
  map.addLayer({
    id: "official-covering-line",
    type: "line",
    source: COVER_SOURCE,
    paint: { "line-color": "#163A34", "line-width": 1.8, "line-opacity": 0.7 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "official-change-highlight-fill",
    type: "fill",
    source: CHANGE_HIGHLIGHT_SOURCE,
    paint: {
      "fill-color": ["match", ["get", "layer"], "planning_area", NUP_FILL, LOCAL_NETWORK_FILL],
      "fill-opacity": 0.2,
    },
  });
  map.addLayer({
    id: "official-change-highlight-line",
    type: "line",
    source: CHANGE_HIGHLIGHT_SOURCE,
    paint: { "line-color": "#163A34", "line-width": 2.8 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "map-candidates-selected",
    type: "line",
    source: CANDIDATES_SOURCE,
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#0B3D2E", "line-width": 2.4 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  map.addLayer({
    id: "map-opportunity-footprints-selected",
    type: "line",
    source: OPP_FOOTPRINT_SOURCE,
    filter: ["==", ["get", "slug"], ""],
    paint: { "line-color": "#0B3D2E", "line-width": 2.5 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
}

function styleOpportunityMarker(el: HTMLElement, item: OpportunityListItem, selected = false, zoom = 4.35) {
  const rejected = item.status === "rejected";
  const shortlisted = item.status === "shortlisted" || item.status === "strong_candidate";
  const close = zoom >= 8;
  const size = selected ? (close ? 10 : 14) : close ? 8 : 12;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "2px";
  el.style.background = "#F7F8F9";
  el.style.border = `${selected ? "2px" : "1.5px"} solid ${rejected ? "#8A8F98" : shortlisted ? "#163A34" : "#2A7A6F"}`;
  el.style.boxShadow = selected ? "0 0 0 2px rgba(42,122,111,0.22)" : "0 0 0 1px rgba(26,30,36,0.16)";
  el.style.cursor = "pointer";
  el.style.opacity = close && !selected ? "0.55" : rejected ? "0.7" : "1";
  el.style.zIndex = selected ? "3" : close ? "1" : "2";
  el.title = `${item.name} · Opportunity`;
  el.setAttribute("aria-label", `${item.name}, opportunity`);
}

function projectRingColor(outlook: Outlook): string {
  const tone = outlookTone(outlook);
  if (tone === "success") return "#3F6E5A";
  if (tone === "warning") return "#8A6A3E";
  if (tone === "critical") return "#8A5552";
  return "#7A7F86";
}

function styleMarkerElement(el: HTMLElement, selected: boolean, project: MapProject) {
  const outlook = projectRingColor(project.outlook);
  el.style.width = selected ? "15px" : "12px";
  el.style.height = selected ? "15px" : "12px";
  el.style.borderRadius = "999px";
  el.style.background = "#F7F8F9";
  el.style.border = `${selected ? "2.5px" : "2px"} solid ${outlook}`;
  el.style.boxShadow = selected ? "0 0 0 2px rgba(26,30,36,0.16)" : "0 0 0 1px rgba(26,30,36,0.14)";
  el.style.cursor = "pointer";
  el.style.zIndex = selected ? "4" : "3";
  el.title = `${project.name} · Project · team outlook ${project.outlook}`;
  el.setAttribute("aria-label", `${project.name}, project`);
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

function setDiscoverySourceData(map: MapLibreMap, sourceId: string, collection: MapGeoJsonFeatureCollection) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: collection.features.flatMap((feature) => {
      if (!feature.geometry) return [];
      return [
        {
          type: "Feature" as const,
          id: feature.id ?? (typeof feature.properties.id === "string" ? feature.properties.id : undefined),
          geometry: feature.geometry as never,
          properties: feature.properties,
        },
      ];
    }),
  });
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
