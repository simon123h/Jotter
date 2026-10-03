export interface CanvasColorOption {
  name: string;
  value: string | null;
  bg: string;
}

export const CANVAS_COLORS: CanvasColorOption[] = [
  { name: 'Default', value: null, bg: 'bg-slate-400' },
  { name: 'Red', value: '#ef4444', bg: 'bg-rose-500' },
  { name: 'Orange', value: '#f97316', bg: 'bg-amber-600' },
  { name: 'Yellow', value: '#eab308', bg: 'bg-yellow-500' },
  { name: 'Green', value: '#22c55e', bg: 'bg-emerald-500' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Purple', value: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Pink', value: '#ec4899', bg: 'bg-pink-500' },
];
