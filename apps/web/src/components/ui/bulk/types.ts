export type BulkMenu = 'none' | 'bucket' | 'tag' | 'priority' | 'planned' | 'project' | 'dueDate' | 'color' | 'postponedDate';

export interface DatePreset {
  id: string;
  label: string;
  /** Days from today; null clears the date. */
  offsetDays: number | null;
  /** Span both grid columns. */
  wide?: boolean;
}
