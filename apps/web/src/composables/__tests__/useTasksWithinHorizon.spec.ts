import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isoDay } from '@jotter/task-filter';
import { useTasksWithinHorizon } from '@/composables/useTasksWithinHorizon';
import { useSettingsStore } from '@/stores/settings';
import { createMockTask } from '@/__tests__/factories';

describe('useTasksWithinHorizon', () => {
  const open = createMockTask({ id: 'open' });
  const tomorrow = createMockTask({ id: 'tomorrow', planned_date: isoDay(1) });
  const later = createMockTask({ id: 'later', planned_date: '2999-01-01' });
  const back = createMockTask({ id: 'back', planned_date: '2000-01-01' });
  const all = () => [open, tomorrow, later, back];

  beforeEach(() => setActivePinia(createPinia()));

  it('leaves out the tasks planned beyond the horizon', () => {
    const settings = useSettingsStore();
    settings.planningHorizon = 'today';
    expect(useTasksWithinHorizon(all).value.map((t) => t.id)).toEqual(['open', 'back']);
    settings.planningHorizon = 'tomorrow';
    expect(useTasksWithinHorizon(all).value.map((t) => t.id)).toEqual(['open', 'tomorrow', 'back']);
  });

  it('keeps all of them when the horizon has no limit', () => {
    useSettingsStore().planningHorizon = 'all';
    expect(useTasksWithinHorizon(all).value.map((t) => t.id)).toEqual(['open', 'tomorrow', 'later', 'back']);
  });
});
