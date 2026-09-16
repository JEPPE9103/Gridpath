/**
 * Profile Malmö planning cold path (ArcGIS + local parse). No DB writes.
 */
const endpoint =
  "https://gis.malmo.se/arcgis/rest/services/SEPlan/Gallande_planer/MapServer/1/query";
const bbox = { west: 12.95, south: 55.55, east: 13.1, north: 55.65 };
const fieldsMinimal =
  "OBJECTID,PLAN_,PLANNAMN,LAGAKRAFT_,BESLUTSDAT,LMAKT,url_dok,FIX_LAGAKR,url_1,url_2";

function buildUrl(outFields, offset = 0, count = 1000) {
  const u = new URL(endpoint);
  u.searchParams.set("f", "geojson");
  u.searchParams.set("outSR", "4326");
  u.searchParams.set("outFields", outFields);
  u.searchParams.set("where", "1=1");
  u.searchParams.set("returnGeometry", "true");
  u.searchParams.set("geometryType", "esriGeometryEnvelope");
  u.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  u.searchParams.set("inSR", "4326");
  u.searchParams.set(
    "geometry",
    `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
  );
  u.searchParams.set("resultOffset", String(offset));
  u.searchParams.set("resultRecordCount", String(count));
  return u.href;
}

async function timed(label, fn) {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  const row = { label, ms, ...result };
  console.log(JSON.stringify(row));
  return row;
}

await timed("layer_metadata", async () => {
  const r = await fetch(endpoint.replace("/query", "") + "?f=json");
  const j = await r.json();
  return {
    maxRecordCount: j.maxRecordCount,
    fieldCount: (j.fields || []).length,
    fields: (j.fields || []).map((f) => f.name),
  };
});

await timed("return_count_only", async () => {
  const u = new URL(endpoint);
  u.searchParams.set("f", "json");
  u.searchParams.set("where", "1=1");
  u.searchParams.set("returnCountOnly", "true");
  u.searchParams.set("geometryType", "esriGeometryEnvelope");
  u.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  u.searchParams.set("inSR", "4326");
  u.searchParams.set(
    "geometry",
    `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
  );
  const r = await fetch(u);
  const j = await r.json();
  return { count: j.count };
});

for (const fields of ["*", fieldsMinimal]) {
  const tag = fields === "*" ? "star" : "min";
  await timed(`page0_${tag}`, async () => {
    const r = await fetch(buildUrl(fields, 0, 1000));
    const text = await r.text();
    const j = JSON.parse(text);
    return {
      bytes: text.length,
      features: (j.features || []).length,
      exceeded: Boolean(j.exceededTransferLimit),
    };
  });
}

// Full bbox pagination with minimal fields
{
  let offset = 0;
  let pages = 0;
  let features = 0;
  let bytes = 0;
  const t0 = Date.now();
  const pageMs = [];
  while (pages < 20) {
    const pt0 = Date.now();
    const r = await fetch(buildUrl(fieldsMinimal, offset, 1000));
    const text = await r.text();
    const j = JSON.parse(text);
    const n = (j.features || []).length;
    const pms = Date.now() - pt0;
    pageMs.push(pms);
    bytes += text.length;
    features += n;
    pages += 1;
    console.log(JSON.stringify({ label: `page_${pages}`, ms: pms, features: n, bytes: text.length }));
    if (n < 1000 && !j.exceededTransferLimit) break;
    offset += n;
    if (n === 0) break;
  }
  console.log(
    JSON.stringify({
      label: "full_bbox_minimal_pagination",
      ms: Date.now() - t0,
      pages,
      features,
      bytes,
      pageMs,
    }),
  );
}
