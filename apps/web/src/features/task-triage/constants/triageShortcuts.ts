export interface TriageShortcut {
  /** i18n key of the description. */
  label: string;
  keys: string;
}

export interface TriageShortcutGroup {
  /** i18n key of the group heading. */
  header: string;
  items: TriageShortcut[];
}

/** Content of the keyboard shortcuts guide. The bindings themselves are registered in TriageView. */
export const TRIAGE_SHORTCUT_GROUPS: TriageShortcutGroup[] = [
  {
    header: 'triage.shortcuts.navHeader',
    items: [
      { label: 'triage.shortcuts.nextTask', keys: 'J' },
      { label: 'triage.shortcuts.prevTask', keys: 'K' },
      { label: 'triage.shortcuts.editTitle', keys: 'Enter' },
      { label: 'triage.shortcuts.addTags', keys: 'A' },
      { label: 'triage.shortcuts.toggleHelp', keys: 'H' },
    ],
  },
  {
    header: 'triage.shortcuts.priorityHeader',
    items: [
      { label: 'triage.shortcuts.urgentPriority', keys: '1' },
      { label: 'triage.shortcuts.highPriority', keys: '2' },
      { label: 'triage.shortcuts.mediumPriority', keys: '3' },
      { label: 'triage.shortcuts.lowPriority', keys: '4' },
      { label: 'triage.shortcuts.clearPriority', keys: '0' },
    ],
  },
  {
    header: 'triage.shortcuts.datesHeader',
    items: [
      { label: 'triage.shortcuts.planToday', keys: 'T' },
      { label: 'triage.shortcuts.planTomorrow', keys: 'O' },
      { label: 'triage.shortcuts.planWeek', keys: 'W' },
      { label: 'triage.shortcuts.planSomeday', keys: 'S' },
      { label: 'triage.shortcuts.clearPlan', keys: 'U' },
    ],
  },
  {
    header: 'triage.shortcuts.opsHeader',
    items: [
      { label: 'triage.shortcuts.markDone', keys: 'V' },
      { label: 'triage.shortcuts.moveToColumn', keys: 'M' },
      { label: 'triage.shortcuts.cycleColor', keys: 'C' },
      { label: 'triage.shortcuts.deleteTask', keys: 'D / Backspace' },
    ],
  },
];
