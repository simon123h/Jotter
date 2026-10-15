import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTasksWithoutPostponed } from '@/composables/useTasksWithoutPostponed';
import { useSettingsStore } from '@/stores/settings';
import { createMockTask } from '@/__tests__/factories';

describe('useTasksWithoutPostponed', () => {
  const open = createMockTask({ id: 'open' });
  const later = createMockTask({ id: 'later', postponed_until: '2999-01-01' });
  const back = createMockTask({ id: 'back', postponed_until: '2000-01-01' });

  beforeEach(() => setActivePinia(createPinia()));

  it('leaves out the tasks that are still postponed while the setting hides them', () => {
    useSettingsStore().hidePostponedColumn = true;
    const shown = useTasksWithoutPostponed(() => [open, later, back]);
    expect(shown.value.map((t) => t.id)).toEqual(['open', 'back']);
  });

  it('keeps all of them when the setting shows them', () => {
    useSettingsStore().hidePostponedColumn = false;
    const shown = useTasksWithoutPostponed(() => [open, later, back]);
    expect(shown.value.map((t) => t.id)).toEqual(['open', 'later', 'back']);
  });
});
