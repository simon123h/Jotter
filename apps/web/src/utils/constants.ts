export interface ColorOption {
  id: string;
  name: string;
  bg: string;
  ring: string;
}

export const TASK_COLORS: ColorOption[] = [
  { id: 'red', name: 'Red', bg: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'orange', name: 'Orange', bg: 'bg-amber-600', ring: 'ring-amber-600' },
  { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-500' },
  { id: 'green', name: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
  { id: 'pink', name: 'Pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
];

export interface TriageColorOption {
  id: string | null;
  bg: string;
  ring: string;
}

export const TRIAGE_COLORS: TriageColorOption[] = [
  { id: null, bg: 'bg-theme-column border-theme-border/40', ring: 'ring-theme-border' },
  { id: 'red', bg: 'bg-rose-500/20 border-rose-500/30', ring: 'ring-rose-500' },
  { id: 'orange', bg: 'bg-amber-600/20 border-amber-600/30', ring: 'ring-amber-600' },
  { id: 'yellow', bg: 'bg-yellow-500/20 border-yellow-500/30', ring: 'ring-yellow-500' },
  { id: 'green', bg: 'bg-emerald-500/20 border-emerald-500/30', ring: 'ring-emerald-500' },
  { id: 'blue', bg: 'bg-blue-500/20 border-blue-500/30', ring: 'ring-blue-500' },
  { id: 'purple', bg: 'bg-purple-500/20 border-purple-500/30', ring: 'ring-purple-500' },
  { id: 'pink', bg: 'bg-pink-500/20 border-pink-500/30', ring: 'ring-pink-500' },
];

export interface PriorityOption {
  id: string;
  label: string;
  color: string;
  bg: string;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { id: 'none', label: 'priorityOptions.none', color: 'text-theme-text-muted', bg: 'bg-theme-column/30' },
  { id: 'low', label: 'priorityOptions.low', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'medium', label: 'priorityOptions.medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'high', label: 'priorityOptions.high', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  {
    id: 'urgent',
    label: 'priorityOptions.urgent',
    color: 'text-rose-400 font-bold',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
];
