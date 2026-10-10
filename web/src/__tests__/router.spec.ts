import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import router from '@/router';
import { useUiStore } from '@/stores/ui';

describe('Router project switching and view mode retention', () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await router.push('/');
  });

  it('defaults to board view when visiting a project without prior state', async () => {
    await router.push({ name: 'project', params: { projectId: 'p1' } });
    expect(router.currentRoute.value.name).toBe('board');
    expect(router.currentRoute.value.params.projectId).toBe('p1');
  });

  it('preserves sticky view modes across project switching', async () => {
    const uiStore = useUiStore();

    // Switch to list view on p1
    await router.push({ name: 'list', params: { projectId: 'p1' } });
    expect(router.currentRoute.value.name).toBe('list');
    expect(uiStore.lastViewMode).toBe('list');

    // Switch to p2 -> should stay in list view
    await router.push({ name: 'project', params: { projectId: 'p2' } });
    expect(router.currentRoute.value.name).toBe('list');
    expect(router.currentRoute.value.params.projectId).toBe('p2');

    // Switch to matrix view on p2
    await router.push({ name: 'matrix', params: { projectId: 'p2' } });
    expect(router.currentRoute.value.name).toBe('matrix');
    expect(uiStore.lastViewMode).toBe('matrix');

    // Switch to p3 -> should stay in matrix view
    await router.push({ name: 'project', params: { projectId: 'p3' } });
    expect(router.currentRoute.value.name).toBe('matrix');
    expect(router.currentRoute.value.params.projectId).toBe('p3');
  });

  it('reverts to board view when switching projects from canvas', async () => {
    const uiStore = useUiStore();

    // User was previously in matrix view
    await router.push({ name: 'matrix', params: { projectId: 'p1' } });
    expect(uiStore.lastViewMode).toBe('matrix');

    // User navigates into canvas
    await router.push({ name: 'canvas', params: { projectId: 'p1' } });
    expect(router.currentRoute.value.name).toBe('canvas');
    // Canvas should NOT overwrite lastViewMode
    expect(uiStore.lastViewMode).toBe('matrix');

    // Switching to p2 while on canvas MUST revert to board view
    await router.push({ name: 'project', params: { projectId: 'p2' } });
    expect(router.currentRoute.value.name).toBe('board');
    expect(router.currentRoute.value.params.projectId).toBe('p2');
  });

  it('reverts to board view when switching projects from canvas task detail modal', async () => {
    // Open task modal inside canvas
    await router.push({ name: 'canvas-task', params: { projectId: 'p1', taskId: 't1' } });
    expect(router.currentRoute.value.meta.backRoute).toBe('canvas');

    // Switching to p2 must revert to board
    await router.push({ name: 'project', params: { projectId: 'p2' } });
    expect(router.currentRoute.value.name).toBe('board');
    expect(router.currentRoute.value.params.projectId).toBe('p2');
  });

  it('reverts to board view when switching projects from triage', async () => {
    const uiStore = useUiStore();

    // User navigates to triage
    await router.push({ name: 'triage', params: { projectId: 'p1' } });
    expect(router.currentRoute.value.name).toBe('triage');
    // Triage should not be recorded as sticky lastViewMode
    expect(uiStore.lastViewMode).not.toBe('triage');

    // Switching to p2 while in triage MUST revert to board view
    await router.push({ name: 'project', params: { projectId: 'p2' } });
    expect(router.currentRoute.value.name).toBe('board');
    expect(router.currentRoute.value.params.projectId).toBe('p2');
  });
});
