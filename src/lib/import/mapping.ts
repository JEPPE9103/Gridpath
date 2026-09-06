export const IMPORT_FIELDS = [
  "name",
  "latitude",
  "longitude",
  "technology",
  "importMw",
  "exportMw",
  "gridOperator",
  "stage",
  "outlook",
  "confidence",
  "targetCod",
  "region",
  "voltageLevel",
  "description",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Project name",
  latitude: "Latitude",
  longitude: "Longitude",
  technology: "Technology",
  importMw: "Import MW",
  exportMw: "Export MW",
  gridOperator: "Grid operator",
  stage: "Development stage",
  outlook: "Project outlook",
  confidence: "Confidence",
  targetCod: "Target COD",
  region: "Region",
  voltageLevel: "Voltage level",
  description: "Description",
};

export const REQUIRED_IMPORT_FIELDS: ImportField[] = ["name", "latitude", "longitude"];

const HEADER_ALIASES: Record<string, ImportField> = {
  "project name": "name",
  project: "name",
  name: "name",
  namn: "name",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
  long: "longitude",
  technology: "technology",
  tech: "technology",
  teknik: "technology",
  "import mw": "importMw",
  import: "importMw",
  importmw: "importMw",
  "export mw": "exportMw",
  export: "exportMw",
  exportmw: "exportMw",
  "grid operator": "gridOperator",
  operator: "gridOperator",
  natagare: "gridOperator",
  "nätägare": "gridOperator",
  "development stage": "stage",
  stage: "stage",
  "connection stage": "stage",
  stadium: "stage",
  "project outlook": "outlook",
  outlook: "outlook",
  confidence: "confidence",
  "target cod": "targetCod",
  "target cod date": "targetCod",
  cod: "targetCod",
  region: "region",
  "voltage level": "voltageLevel",
  voltage: "voltageLevel",
  spanning: "voltageLevel",
  "spänning": "voltageLevel",
  description: "description",
  beskrivning: "description",
  location: "region",
};

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export type ColumnMapping = Partial<Record<ImportField, number>>;

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((header, index) => {
    const field = HEADER_ALIASES[headerKey(header)];
    if (field && mapping[field] == null) {
      mapping[field] = index;
    }
  });
  return mapping;
}

export const IMPORT_TEMPLATE_HEADERS = IMPORT_FIELDS.map((field) => IMPORT_FIELD_LABELS[field]);

export const IMPORT_TEMPLATE_EXAMPLE_ROW = [
  "Gavle Battery North",
  "60.6749",
  "17.1413",
  "Battery Storage",
  "20",
  "20",
  "",
  "Prospect",
  "Unknown",
  "Unknown",
  "2028",
  "Gavleborg",
  "",
  "",
];
