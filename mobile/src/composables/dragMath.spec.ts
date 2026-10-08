import { describe, it, expect } from 'vitest';
import { computeDropTarget, positionBetween, positionForIndex, edgeScrollSpeed, DOCK_KEY, type ColumnBox, type DockBox } from './dragMath';

const columns: ColumnBox[] = [
  {
    key: 'todo',
    bucket: 'todo',
    left: 0,
    right: 390,
    cards: [
      { id: 'a', top: 0, bottom: 100 },
      { id: 'b', top: 110, bottom: 210 },
    ],
  },
  { key: 'done', bucket: 'done', left: 390, right: 780, cards: [] },
  { key: '__other', bucket: null, left: 780, right: 1170, cards: [{ id: 'x', top: 0, bottom: 100 }] },
];

describe('computeDropTarget', () => {
  it('finds the column under the finger and the gap between its cards', () => {
    expect(computeDropTarget(columns, 100, 20)).toEqual({ columnKey: 'todo', bucket: 'todo', index: 0 });
    expect(computeDropTarget(columns, 100, 120)).toEqual({ columnKey: 'todo', bucket: 'todo', index: 1 });
    expect(computeDropTarget(columns, 100, 400)).toEqual({ columnKey: 'todo', bucket: 'todo', index: 2 });
  });

  it('drops into an empty column at index 0', () => {
    expect(computeDropTarget(columns, 500, 300)).toEqual({ columnKey: 'done', bucket: 'done', index: 0 });
  });

  it('accepts no drop outside the columns or into the column of unknown buckets', () => {
    expect(computeDropTarget(columns, 2000, 10)).toBeNull();
    expect(computeDropTarget(columns, 900, 10)).toBeNull();
  });
});

describe('computeDropTarget with the dock', () => {
  const dock: DockBox[] = [
    { bucket: 'todo', left: 0, right: 130, top: 700, bottom: 760 },
    { bucket: 'done', left: 130, right: 260, top: 700, bottom: 760 },
  ];

  it('sends a card dropped on a chip to the end of that bucket, whatever column is behind it', () => {
    expect(computeDropTarget(columns, 200, 730, dock, 'todo')).toEqual({
      columnKey: DOCK_KEY,
      bucket: 'done',
      index: Number.MAX_SAFE_INTEGER,
      dock: true,
    });
  });

  it('ignores the chip of the bucket the card is already in', () => {
    expect(computeDropTarget(columns, 50, 730, dock, 'todo')).toBeNull();
  });

  it('falls back to the columns above the dock', () => {
    expect(computeDropTarget(columns, 100, 120, dock, 'done')).toEqual({ columnKey: 'todo', bucket: 'todo', index: 1 });
  });
});

describe('positions', () => {
  it('goes between neighbours, and past the ends', () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(undefined, 1000)).toBe(0);
    expect(positionBetween(3000, undefined)).toBe(4000);
    expect(positionBetween(undefined, undefined)).toBe(1000);
  });

  it('still gives a distinct position between equal neighbours', () => {
    expect(positionBetween(2000, 2000)).toBeGreaterThan(2000);
  });

  it('picks the neighbours from the insertion index', () => {
    const siblings = [1000, 2000, 3000];
    expect(positionForIndex(siblings, 0)).toBe(0);
    expect(positionForIndex(siblings, 1)).toBe(1500);
    expect(positionForIndex(siblings, 3)).toBe(4000);
    expect(positionForIndex([], 0)).toBe(1000);
  });
});

describe('edgeScrollSpeed', () => {
  it('is zero in the middle and grows towards the edges', () => {
    expect(edgeScrollSpeed(195, 390)).toBe(0);
    expect(edgeScrollSpeed(28, 390)).toBe(-5);
    expect(edgeScrollSpeed(0, 390)).toBe(-10);
    expect(edgeScrollSpeed(390, 390)).toBe(10);
  });
});
