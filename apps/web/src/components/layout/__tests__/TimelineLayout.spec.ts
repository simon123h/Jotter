import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { isoDay, plannedFor } from '@jotter/task-filter';
import { createMockTask } from '@/__tests__/factories';
import TimelineLayout from '../TimelineLayout.vue';
import GenericColumn from '@/components/ui/GenericColumn.vue';

const setPlanned = vi.fn();
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { projectId: 'p' } }) }));
vi.mock('@/composables/useBuckets', () => ({ useBuckets: () => ({ fetchBuckets: vi.fn() }) }));
vi.mock('@/composables/useTaskMutations', () => ({
  useTaskMutations: () => ({ handleMarkTaskDone: vi.fn(), handleTimeViewPlannedDateUpdate: setPlanned }),
}));

describe('TimelineLayout.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setPlanned.mockReset();
  });

  const mountWith = (
    tasks = [createMockTask({ id: 'a', planned_date: isoDay(2) }), createMockTask({ id: 'slip', planned_date: '2000-01-01' })]
  ) => mount(TimelineLayout, { props: { tasks, groupName: 'time-view' }, global: { stubs: { GenericColumn: true, SnapScroller: false } } });
  const columns = (wrapper: ReturnType<typeof mountWith>) => wrapper.findAllComponents(GenericColumn);
  const drop = (wrapper: ReturnType<typeof mountWith>, taskId: string, toId: string) =>
    columns(wrapper)[0].vm.$emit('card-dropped', { taskId, toId });

  it('shows a column for what has slipped only when something has', () => {
    expect(columns(mountWith()).map((c) => c.props('id'))).toEqual(['none', 'slipped', 'today', 'tomorrow', 'week', 'month', 'later']);
    expect(columns(mountWith([createMockTask({ id: 'a', planned_date: isoDay(0) })])).map((c) => c.props('id'))).not.toContain('slipped');
  });

  it('plans a dropped task for the stretch of time it was dropped on', async () => {
    const wrapper = mountWith();
    await drop(wrapper, 'a', 'tomorrow');
    expect(setPlanned).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'a', plannedDate: plannedFor('tomorrow') }));
  });

  it('does not plan anything for a drop on Slipped', async () => {
    const wrapper = mountWith();
    await drop(wrapper, 'a', 'slipped');
    expect(setPlanned).not.toHaveBeenCalled();
  });

  it('leaves a task alone that is dropped on the stretch it is in: a day does not widen to the week', async () => {
    const wrapper = mountWith([createMockTask({ id: 'today', planned_date: isoDay(0) })]);
    await drop(wrapper, 'today', 'today');
    expect(setPlanned).not.toHaveBeenCalled();
  });
});
