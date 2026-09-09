/**
 * Contiguous candidate-area helpers.
 *
 * Adjacency rule: 4-connected (shared edge). Cells that only touch at a corner
 * are not merged. Centroid proximity is never used.
 *
 * PostGIS implements the same rule by ST_UnaryUnion of remaining usable
 * polygons followed by ST_Dump: edge-adjacent squares dissolve; corner-only
 * and disconnected fragments stay separate.
 */

export const SLIVER_AREA_HA = 0.5;

export type GridCell = {
  id: string;
  column: number;
  row: number;
  qualifying: boolean;
  usableAreaHa: number;
};

export type ContiguousGroup = {
  cellIds: string[];
  cellCount: number;
  totalUsableAreaHa: number;
};

export function mergeAdjacentQualifyingCells(cells: GridCell[]): ContiguousGroup[] {
  const byKey = new Map<string, GridCell>();
  for (const cell of cells) {
    if (!cell.qualifying) continue;
    byKey.set(`${cell.column}:${cell.row}`, cell);
  }

  const visited = new Set<string>();
  const groups: ContiguousGroup[] = [];
  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (const cell of byKey.values()) {
    const start = `${cell.column}:${cell.row}`;
    if (visited.has(start)) continue;
    const queue = [cell];
    visited.add(start);
    const members: GridCell[] = [];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      members.push(current);
      for (const [dx, dy] of deltas) {
        const nextKey = `${current.column + dx}:${current.row + dy}`;
        if (visited.has(nextKey)) continue;
        const neighbour = byKey.get(nextKey);
        if (!neighbour) continue;
        visited.add(nextKey);
        queue.push(neighbour);
      }
    }
    groups.push({
      cellIds: members.map((item) => item.id),
      cellCount: members.length,
      totalUsableAreaHa: members.reduce((sum, item) => sum + item.usableAreaHa, 0),
    });
  }

  return groups.sort((left, right) => right.totalUsableAreaHa - left.totalUsableAreaHa);
}

export function dropSliverAreas<T extends { areaHa: number }>(
  parts: T[],
  minHa: number = SLIVER_AREA_HA,
): T[] {
  return parts.filter((part) => part.areaHa >= minHa);
}

export function largestContiguousAreaHa(areasHa: number[]): number {
  if (areasHa.length === 0) return 0;
  return Math.max(...areasHa);
}

export function meetsMinimumContiguousArea(
  largestContiguousHa: number,
  minimumHa: number | null,
): boolean {
  if (minimumHa == null) return true;
  return largestContiguousHa + 1e-9 >= minimumHa;
}

export type ExclusionBreakdown = {
  grossHa: number;
  protectedHa: number;
  naturaHa: number;
  terrainHa: number;
  landCoverHa: number;
  remainingHa: number;
  largestContiguousHa: number;
};

export function buildExclusionBreakdown(input: {
  grossHa: number;
  protectedHa?: number;
  naturaHa?: number;
  terrainHa?: number;
  landCoverHa?: number;
  remainingHa: number;
  largestContiguousHa: number;
}): ExclusionBreakdown {
  return {
    grossHa: input.grossHa,
    protectedHa: input.protectedHa ?? 0,
    naturaHa: input.naturaHa ?? 0,
    terrainHa: input.terrainHa ?? 0,
    landCoverHa: input.landCoverHa ?? 0,
    remainingHa: input.remainingHa,
    largestContiguousHa: input.largestContiguousHa,
  };
}

export function formatExclusionBreakdown(breakdown: ExclusionBreakdown): string {
  return [
    `Initial area: ${breakdown.grossHa.toFixed(1)} ha`,
    `Protected/Natura removed: ${(breakdown.protectedHa + breakdown.naturaHa).toFixed(1)} ha`,
    `Terrain removed: ${breakdown.terrainHa.toFixed(1)} ha`,
    `Configured land-cover exclusions removed: ${breakdown.landCoverHa.toFixed(1)} ha`,
    `Remaining: ${breakdown.remainingHa.toFixed(1)} ha`,
    `Largest contiguous: ${breakdown.largestContiguousHa.toFixed(1)} ha`,
  ].join(". ");
}
