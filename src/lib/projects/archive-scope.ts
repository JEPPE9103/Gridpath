export const ARCHIVE_VIEWS = ["active", "archived", "all"] as const;

export type ArchiveView = (typeof ARCHIVE_VIEWS)[number];

export function parseArchiveView(value: string | null | undefined): ArchiveView {
  if (value === "archived" || value === "all") {
    return value;
  }
  return "active";
}

export function isArchivedTimestamp(archivedAt: string | null | undefined): boolean {
  return Boolean(archivedAt);
}

/** Default portfolio/overview/map/report surfaces only include active projects. */
export function isActiveArchiveView(view: ArchiveView): boolean {
  return view === "active";
}
