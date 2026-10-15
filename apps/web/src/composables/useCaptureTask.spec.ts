import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

const getBuckets = vi.hoisted(() => vi.fn());
vi.mock('@/api', () => ({ getBuckets, getSettings: vi.fn(async () => ({})), saveSettings: vi.fn(), getProjects: vi.fn(async () => []) }));

import { useCaptureTask } from './useCaptureTask';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';

describe('useCaptureTask', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getBuckets.mockReset();
    getBuckets.mockResolvedValue([
      { name: 'todo', title: 'To Do' },
      { name: 'inbox', title: 'Inbox', is_default: true },
    ]);
    useProjectStore().projects = [
      { id: 'work', title: 'Work' },
      { id: 'inbox', title: 'Inbox' },
    ] as never;
  });

  const setup = (current = '') => {
    const open = vi.fn();
    const create = vi.fn();
    const capture = useCaptureTask(ref(current), open, create);
    return { capture, open, create };
  };

  it('opens the project for quick capture and its default column, from a page without a project', async () => {
    useSettingsStore().captureProjectId = 'inbox';
    const { capture, open, create } = setup('');
    await capture();
    expect(open).toHaveBeenCalledWith('inbox');
    expect(create).toHaveBeenCalledWith('inbox');
  });

  it('stays where it is when that project is already open', async () => {
    useSettingsStore().captureProjectId = 'inbox';
    const { capture, open, create } = setup('inbox');
    await capture();
    expect(open).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith('inbox');
  });

  it('does nothing when no project is chosen, the chosen one is gone, or a dialog is open', async () => {
    const settings = useSettingsStore();
    const { capture, open, create } = setup('work');

    settings.captureProjectId = null;
    await capture();
    settings.captureProjectId = 'deleted';
    await capture();
    settings.captureProjectId = 'inbox';
    useModalStore().openModal('filter');
    await capture();

    expect(open).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
