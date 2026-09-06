/** PostgREST `max_rows` in supabase/config.toml. Unbounded selects can silently truncate. */
export const POSTGREST_MAX_ROWS = 1000;

/** Stay under typical URL length limits for `.in()` filters. */
export const POSTGREST_IN_CHUNK = 200;

export const PORTFOLIO_PAGE_SIZE = 50;

export type PagedSelectError = { message: string };

export type PagedSelectPageResult<T> = {
  data: T[] | null;
  error: PagedSelectError | null;
};

const HARD_ROW_CAP = 100_000;

export async function fetchAllQueryPages<T>(
  runPage: (from: number, to: number) => Promise<PagedSelectPageResult<T>>,
  pageSize = POSTGREST_MAX_ROWS,
): Promise<{ rows: T[]; error: string | null; pageCount: number; hitSafetyCap: boolean }> {
  const rows: T[] = [];
  let from = 0;
  let pageCount = 0;
  let hitSafetyCap = false;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await runPage(from, to);
    if (error) {
      return { rows, error: error.message, pageCount, hitSafetyCap };
    }
    const chunk = data ?? [];
    pageCount += 1;
    rows.push(...chunk);
    if (chunk.length < pageSize) {
      break;
    }
    from += pageSize;
    if (rows.length >= HARD_ROW_CAP) {
      hitSafetyCap = true;
      break;
    }
  }

  return { rows, error: null, pageCount, hitSafetyCap };
}

export async function fetchAllInChunks<T>(
  ids: string[],
  runChunk: (chunk: string[]) => Promise<PagedSelectPageResult<T>>,
  chunkSize = POSTGREST_IN_CHUNK,
): Promise<{ rows: T[]; error: string | null }> {
  if (ids.length === 0) {
    return { rows: [], error: null };
  }

  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await runChunk(chunk);
    if (error) {
      return { rows, error: error.message };
    }
    rows.push(...(data ?? []));
  }
  return { rows, error: null };
}

export function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
