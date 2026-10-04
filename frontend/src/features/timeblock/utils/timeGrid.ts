import type { Task, Timeblock } from '@/types';

/** Pixel height of one hour on the day grid. */
export const HOUR_HEIGHT = 132;

/** Moving and resizing snap to this many minutes. */
export const SNAP_MINUTES = 15;

export const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minutesToTime = (mins: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Matches the Task Card color palette
const TASK_CARD_COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
};

/** Absolute position, size and tint of a timeblock box within the visible hour range. */
export const getTimeblockStyle = (tb: Timeblock, startHour: number, endHour: number) => {
  const minMinutes = startHour * 60;
  const maxMinutes = (endHour + 1) * 60;

  const startMin = Math.max(minMinutes, timeToMinutes(tb.start_time));
  const endMin = Math.min(maxMinutes, timeToMinutes(tb.end_time));
  const durationMin = Math.max(20, endMin - startMin);

  const topPx = ((startMin - minMinutes) / 60) * HOUR_HEIGHT;
  const heightPx = (durationMin / 60) * HOUR_HEIGHT;

  const rawColor = tb.color || 'blue';
  const hex = TASK_CARD_COLOR_MAP[rawColor] || TASK_CARD_COLOR_MAP.blue;

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    '--card-tint': hex,
    backgroundColor: `color-mix(in srgb, ${hex} 22%, var(--theme-bg-card))`,
    borderColor: `color-mix(in srgb, ${hex} 48%, var(--theme-border))`,
  };
};

/** Pixel offset of the current time on the grid, or null when outside the visible hours. */
export const getNowIndicatorTop = (now: Date, startHour: number, endHour: number): number | null => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const minMinutes = startHour * 60;
  const maxMinutes = (endHour + 1) * 60;
  if (minutes < minMinutes || minutes > maxMinutes) return null;
  return ((minutes - minMinutes) / 60) * HOUR_HEIGHT;
};

export const isTaskDone = (task: Task): boolean => {
  return ['done', 'archive', 'archived', 'completed'].includes(task.bucket.toLowerCase());
};
