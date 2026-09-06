import type { ArchiveView } from "@/lib/projects/archive-scope";

type FilterBuilder = {
  is: (column: string, value: null) => FilterBuilder;
  not: (column: string, operator: string, value: null) => FilterBuilder;
};

export function applyArchiveFilter<T extends FilterBuilder>(query: T, view: ArchiveView, column = "archived_at"): T {
  if (view === "archived") {
    return query.not(column, "is", null) as T;
  }
  if (view === "all") {
    return query;
  }
  return query.is(column, null) as T;
}
