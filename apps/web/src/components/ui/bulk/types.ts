export type BulkMenu = 'none' | 'bucket' | 'tag' | 'priority' | 'planned' | 'project' | 'dueDate' | 'color';

export interface DatePreset {
  id: string;
  label: string;
  /** Days from today; null clears the date. */
  offsetDays: number | null;
  /** A value to set as it is (a planned week or month), which takes the place of the days. */
  value?: string;
  /** Span both grid columns. */
  wide?: boolean;
}
