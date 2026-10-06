/** Where a dragged card would land, worked out from where the columns and cards are on screen. */

export interface ColumnBox {
  key: string;
  /** The bucket tasks dropped here get, or null for the column of unknown buckets (no drops there). */
  bucket: string | null;
  left: number;
  right: number;
  /** The cards in the column from top to bottom, without the dragged one. */
  cards: { id: string; top: number; bottom: number }[];
}

export interface DropTarget {
  columnKey: string;
  bucket: string;
  /** Index among the column's cards (without the dragged one) the card is inserted at. */
  index: number;
}

/** The column under `x` and the index between its cards that `y` points at. Null when nothing accepts a drop. */
export function computeDropTarget(columns: ColumnBox[], x: number, y: number): DropTarget | null {
  const column = columns.find((c) => x >= c.left && x < c.right);
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

/** The position for a card dropped at `index` among `siblings` (their positions, in order). */
export function positionForIndex(siblings: number[], index: number): number {
  return positionBetween(siblings[index - 1], siblings[index]);
}

/** How fast to scroll sideways when the finger is near an edge: 0 in the middle, up to `max` at the edge. */
export function edgeScrollSpeed(x: number, width: number, zone = 56, max = 10): number {
  if (x < zone) return -Math.round(max * Math.min(1, (zone - x) / zone));
  if (x > width - zone) return Math.round(max * Math.min(1, (x - (width - zone)) / zone));
  return 0;
}
