/** Where a dragged row would land, worked out from where the list and its rows are on screen. */

export interface ColumnBox {
  key: string;
  /** The bucket of the column, or null for the column of unknown buckets. */
  bucket: string | null;
  left: number;
  right: number;
  /** The rows in the column from top to bottom, without the dragged one. */
  cards: { id: string; top: number; bottom: number }[];
}

export interface DropTarget {
  columnKey: string;
  bucket: string;
  /** Index among the column's rows (without the dragged one) the row is inserted at. */
  index: number;
}

/**
 * The gap between the rows of the column that `y` points at. Rows are only rearranged inside their own column
 * (moving across columns is what the swipe and the move picker are for), so callers pass just that column.
 * Null when the column is not one that accepts drops.
 */
export function computeDropTarget(columns: ColumnBox[], x: number, y: number): DropTarget | null {
  const column = columns.find((c) => x >= c.left && x < c.right) ?? (columns.length === 1 ? columns[0] : undefined);
  if (!column || column.bucket === null) return null;
  const index = column.cards.filter((card) => (card.top + card.bottom) / 2 < y).length;
  return { columnKey: column.key, bucket: column.bucket, index };
}

/** A position between two neighbours, so only the moved task has to be rewritten. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1000;
  if (before === undefined) return after! - 1000;
  if (after === undefined) return before + 1000;
  // Two equal neighbours cannot be split; nudge past the first one
  return after - before < 1e-9 ? before + 0.001 : (before + after) / 2;
}

/** The position for a row dropped at `index` among `siblings` (their positions, in order). */
export function positionForIndex(siblings: number[], index: number): number {
  return positionBetween(siblings[index - 1], siblings[index]);
}
