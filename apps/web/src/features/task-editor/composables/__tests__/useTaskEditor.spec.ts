import { beforeAll, describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTaskEditor } from '../useTaskEditor';
import { createMockTask } from '@/__tests__/factories';
import type { Task } from '@/types';

beforeAll(() => {
  setActivePinia(createPinia());
});

function setup(task: Task) {
  const patchTask = vi.fn(async (_: Task, data: Partial<Task>) => ({ ...task, ...data }));
  const editor = useTaskEditor({ task: ref(task), buckets: ref([]), locale: ref('en'), patchTask, titleInput: ref(null) });
  editor.initEditState(task);
  return { editor, patchTask };
}

describe('useTaskEditor: repeat rules and reminders', () => {
  it('reads the rule and the reminders of the task into the form', () => {
    const { editor } = setup(createMockTask({ repeat: { every: 3, unit: 'month', from: 'due' }, reminders: ['2030-05-01T08:30'] }));

    expect(editor.form).toMatchObject({
      repeatKind: 'custom',
      repeatUnit: 'month',
      repeatEvery: 3,
      repeatFrom: 'due',
      reminders: ['2030-05-01T08:30'],
    });
  });

  it('saves a preset as every one unit, and a custom rule with its number and unit', async () => {
    const { editor, patchTask } = setup(createMockTask({ title: 'Water plants' }));

    editor.form.repeatKind = 'week';
    editor.pickRepeat();
    await editor.handleSave();
    expect(patchTask.mock.calls[0][1].repeat).toEqual({ every: 1, unit: 'week', from: 'completion' });

    editor.form.repeatKind = 'custom';
    editor.pickRepeat();
    editor.form.repeatEvery = 3;
    editor.form.repeatUnit = 'day';
    editor.form.repeatFrom = 'due';
    await editor.handleSave();
    expect(patchTask.mock.calls[1][1].repeat).toEqual({ every: 3, unit: 'day', from: 'due' });
  });

  it('saves no rule for Never, and reminders sorted and without duplicates', async () => {
    const { editor, patchTask } = setup(createMockTask({ title: 'Water plants', repeat: { every: 1, unit: 'day', from: 'completion' } }));

    editor.form.repeatKind = '';
    editor.pickRepeat();
    editor.form.reminders = ['2030-05-02T09:00', '2030-05-01T08:30', '2030-05-02T09:00', ''];
    await editor.handleSave();

    expect(patchTask.mock.calls[0][1]).toMatchObject({ repeat: null, reminders: ['2030-05-01T08:30', '2030-05-02T09:00'] });
  });

  it('adds a reminder at nine on the due day, or tomorrow, and removes one', () => {
    const { editor } = setup(createMockTask({ due_date: '2030-05-01' }));

    editor.addReminder();
    expect(editor.form.reminders).toEqual(['2030-05-01T09:00']);
    editor.removeReminder(0);
    expect(editor.form.reminders).toEqual([]);
  });

  it('keeps the planned date when another column is picked, and ends it when the date is cleared', async () => {
    const { editor, patchTask } = setup(createMockTask({ title: 'Water plants', bucket: 'todo', planned_date: '2030-W19' }));

    editor.form.bucket = 'in-progress';
    await editor.handleSave();
    expect(patchTask.mock.calls[0][1]).toMatchObject({ bucket: 'in-progress', planned_date: '2030-W19' });

    editor.form.plannedDate = '';
    await editor.handleSave();
    expect(patchTask.mock.calls[1][1]).toMatchObject({ planned_date: '' });
  });
});
