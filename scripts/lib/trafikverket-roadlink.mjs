/**
 * Trafikverket INSPIRE RoadLink WFS request builder.
 * Official GetFeature uses typeNames=RoadLink (not tn-ro:RoadLink).
 * EPSG:4326 bbox on this service is lat,lon axis order.
 */
export const TRAFIKVERKET_ROADLINK_WFS =
  "https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork";
export const TRAFIKVERKET_ROADLINK_TYPE = "RoadLink";

/**
 * @param {{ west: number, south: number, east: number, north: number }} bbox
 * @param {number} startIndex
 * @param {"latlon" | "lonlat"} axis
 */
export function buildRoadLinkWfsUrl(bbox, startIndex, axis = "latlon") {
  const url = new URL(TRAFIKVERKET_ROADLINK_WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", TRAFIKVERKET_ROADLINK_TYPE);
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set("count", "5000");
  if (startIndex > 0) url.searchParams.set("startIndex", String(startIndex));
  if (axis === "latlon") {
    url.searchParams.set("bbox", `${bbox.south},${bbox.west},${bbox.north},${bbox.east},EPSG:4326`);
  } else {
    url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`);
  }
  return url.href;
}
