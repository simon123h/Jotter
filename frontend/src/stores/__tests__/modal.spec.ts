import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useModalStore } from '../modal';

describe('modal store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with null active modal', () => {
    const store = useModalStore();
    expect(store.activeModal).toBeNull();
    expect(store.modalProps).toEqual({});
  });

  it('opens and closes modals generic way', () => {
    const store = useModalStore();
    store.openModal('filter', { foo: 'bar' });
    expect(store.activeModal).toBe('filter');
    expect(store.modalProps).toEqual({ foo: 'bar' });

    store.closeModal();
    expect(store.activeModal).toBeNull();
    expect(store.modalProps).toEqual({});
  });

  it('opens task-create via helper', () => {
    const store = useModalStore();
    store.openTaskCreate('todo', { custom: 123 });
    expect(store.activeModal).toBe('task-create');
    expect(store.modalProps).toEqual({ defaultBucket: 'todo', custom: 123 });
  });

  it('opens project-edit via helper', () => {
    const store = useModalStore();
    const mockProj = { id: 'p1', title: 'Test' } as any;
    store.openProjectEdit(mockProj);
    expect(store.activeModal).toBe('project-edit');
    expect(store.modalProps).toEqual({ project: mockProj });
  });

  it('opens filter via helper', () => {
    const store = useModalStore();
    store.openFilter();
    expect(store.activeModal).toBe('filter');
  });

  it('opens import-spreadsheet via helper', () => {
    const store = useModalStore();
    store.openImportSpreadsheet('project-xyz');
    expect(store.activeModal).toBe('import-spreadsheet');
    expect(store.modalProps).toEqual({ projectId: 'project-xyz' });
  });

  it('opens move-tasks-confirm via helper', () => {
    const store = useModalStore();
    store.openMoveTasksConfirm(['t1'], 'p2');
    expect(store.activeModal).toBe('move-tasks-confirm');
    expect(store.modalProps).toEqual({ taskIds: ['t1'], targetProjectId: 'p2' });
  });

  it('opens time-machine via helper', () => {
    const store = useModalStore();
    store.openTimeMachine('p1');
    expect(store.activeModal).toBe('time-machine');
    expect(store.modalProps).toEqual({ projectId: 'p1' });
  });
});
