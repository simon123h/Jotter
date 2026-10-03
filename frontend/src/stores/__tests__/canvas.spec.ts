import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCanvasStore } from '@/stores/canvas';
import * as api from '@/api';
import type { Task, CanvasDocument, CanvasEdge } from '@/types';

vi.mock('@/api', () => ({
  getCanvases: vi.fn(),
  getCanvas: vi.fn(),
  saveCanvas: vi.fn(),
  deleteCanvas: vi.fn(),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('Canvas Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default state', () => {
    const store = useCanvasStore();
    expect(store.currentProjectId).toBe('');
    expect(store.activeCanvasId).toBe('main');
    expect(store.canvases).toEqual([]);
    expect(store.currentDocument).toEqual({ nodes: [], edges: [] });
    expect(store.isDrawerOpen).toBe(false);
    expect(store.interactionMode).toBe('pan');
  });

  it('toggles interaction mode between pan and select', () => {
    const store = useCanvasStore();
    expect(store.interactionMode).toBe('pan');

    store.toggleInteractionMode();
    expect(store.interactionMode).toBe('select');

    store.toggleInteractionMode();
    expect(store.interactionMode).toBe('pan');
  });

  it('toggles task drawer open state', () => {
    const store = useCanvasStore();
    expect(store.isDrawerOpen).toBe(false);

    store.toggleDrawer();
    expect(store.isDrawerOpen).toBe(true);

    store.toggleDrawer();
    expect(store.isDrawerOpen).toBe(false);
  });

  it('fetches canvases list and defaults to main canvas if empty', async () => {
    const store = useCanvasStore();
    vi.mocked(api.getCanvases).mockResolvedValueOnce([]);

    await store.fetchCanvases('proj-1');
    expect(api.getCanvases).toHaveBeenCalledWith('proj-1');
    expect(store.canvases).toEqual([{ id: 'main', title: 'main' }]);

    vi.mocked(api.getCanvases).mockResolvedValueOnce([{ id: 'sprint-1', title: 'Sprint 1', filename: 'sprint-1.canvas' }]);
    await store.fetchCanvases('proj-1');
    expect(store.canvases).toHaveLength(1);
    expect(store.canvases[0].id).toBe('sprint-1');
  });

  it('loads canvas document successfully', async () => {
    const store = useCanvasStore();
    const mockDoc: CanvasDocument = {
      nodes: [{ id: 'node-1', type: 'text', text: 'Note 1', x: 10, y: 20, width: 200, height: 100 }],
      edges: [],
    };
    vi.mocked(api.getCanvas).mockResolvedValueOnce(mockDoc);

    await store.loadCanvas('proj-1', 'sprint-1');
    expect(store.currentProjectId).toBe('proj-1');
    expect(store.activeCanvasId).toBe('sprint-1');
    expect(store.currentDocument).toEqual(mockDoc);
    expect(store.nodes).toHaveLength(1);
    expect(store.isLoading).toBe(false);
  });

  it('handles load canvas error gracefully with fallback empty document', async () => {
    const store = useCanvasStore();
    vi.mocked(api.getCanvas).mockRejectedValueOnce(new Error('Network error'));

    await store.loadCanvas('proj-1', 'corrupted');
    expect(store.currentDocument).toEqual({ nodes: [], edges: [] });
    expect(store.isLoading).toBe(false);
  });

  it('tracks placed task IDs correctly', () => {
    const store = useCanvasStore();
    const task1 = { id: 'task-123', color: 'blue' } as Task;
    const task2 = { id: 'task-456' } as Task;

    store.addFileNode(task1, 100, 100);
    expect(store.isTaskPlaced('task-123')).toBe(true);
    expect(store.isTaskPlaced('task-456')).toBe(false);
    expect(store.placedTaskIdSet.has('task-123')).toBe(true);

    store.addFileNode(task2, 200, 200);
    expect(store.isTaskPlaced('task-456')).toBe(true);
  });

  it('adds and removes text, group, and file nodes', () => {
    const store = useCanvasStore();
    const textNode = store.addTextNode('My Note', 50, 60, 220, 140);
    const groupNode = store.addGroupNode('Sprint Group', 0, 0, 500, 400);

    expect(store.nodes).toHaveLength(2);
    expect(textNode.text).toBe('My Note');
    expect(groupNode.label).toBe('Sprint Group');

    store.removeNode(textNode.id);
    expect(store.nodes).toHaveLength(1);
    expect(store.nodes[0].id).toBe(groupNode.id);
  });

  it('updates node position, size, and custom data', () => {
    const store = useCanvasStore();
    const textNode = store.addTextNode('Initial', 10, 10, 200, 100);

    store.updateNodePositionAndSize(textNode.id, 55.4, 88.6, 300.2, 180.7);
    const updated = store.nodes.find((n) => n.id === textNode.id);
    expect(updated?.x).toBe(55);
    expect(updated?.y).toBe(89);
    expect(updated?.width).toBe(300);
    expect(updated?.height).toBe(181);

    store.updateNodeData(textNode.id, { text: 'Updated Text' });
    expect(updated?.text).toBe('Updated Text');
  });

  it('manages edges: adding, deduplicating, updating, reversing, and removing', () => {
    const store = useCanvasStore();
    const nodeA = store.addTextNode('A', 0, 0);
    const nodeB = store.addTextNode('B', 200, 0);

    const edge: CanvasEdge = {
      id: 'edge-1',
      fromNode: nodeA.id,
      fromSide: 'right',
      toNode: nodeB.id,
      toSide: 'left',
      color: '#3b82f6',
    };

    store.addEdge(edge);
    expect(store.edges).toHaveLength(1);

    // Duplicate add should be ignored
    store.addEdge(edge);
    expect(store.edges).toHaveLength(1);

    // Update edge
    store.updateEdge('edge-1', { toEnd: 'arrow', color: '#10b981' });
    expect(store.edges[0].toEnd).toBe('arrow');
    expect(store.edges[0].color).toBe('#10b981');

    // Reverse edge
    store.reverseEdge('edge-1');
    expect(store.edges[0].fromNode).toBe(nodeB.id);
    expect(store.edges[0].fromSide).toBe('left');
    expect(store.edges[0].toNode).toBe(nodeA.id);
    expect(store.edges[0].toSide).toBe('right');
    expect(store.edges[0].toEnd).toBe('arrow');

    // Removing connected node should also clean up edge
    store.removeNode(nodeA.id);
    expect(store.edges).toHaveLength(0);
  });

  it('triggers debounced auto-save on modifications', async () => {
    const store = useCanvasStore();
    store.currentProjectId = 'proj-1';
    store.activeCanvasId = 'main';

    store.addTextNode('Debounced', 10, 10);
    expect(api.saveCanvas).not.toHaveBeenCalled();

    // Fast forward debounce timer
    vi.advanceTimersByTime(500);
    await Promise.resolve();

    expect(api.saveCanvas).toHaveBeenCalledWith(
      'proj-1',
      'main',
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ text: 'Debounced' })]),
      })
    );
  });

  it('flushes auto-save immediately when requested', async () => {
    const store = useCanvasStore();
    store.currentProjectId = 'proj-1';
    store.activeCanvasId = 'main';

    store.addTextNode('Flush Me', 20, 20);
    expect(api.saveCanvas).not.toHaveBeenCalled();

    await store.flushAutoSave();
    expect(api.saveCanvas).toHaveBeenCalledTimes(1);
  });

  it('creates and deletes canvases', async () => {
    const store = useCanvasStore();
    vi.mocked(api.saveCanvas).mockResolvedValueOnce({ nodes: [], edges: [] });
    vi.mocked(api.getCanvases).mockResolvedValueOnce([{ id: 'new-canvas', title: 'New Canvas' }]);

    const slug = await store.createNewCanvas('proj-1', 'New Canvas!');
    expect(slug).toBe('new-canvas');
    expect(api.saveCanvas).toHaveBeenCalledWith('proj-1', 'new-canvas', { nodes: [], edges: [] });

    vi.mocked(api.deleteCanvas).mockResolvedValueOnce();
    vi.mocked(api.getCanvases).mockResolvedValueOnce([]);
    vi.mocked(api.getCanvas).mockResolvedValueOnce({ nodes: [], edges: [] });

    store.activeCanvasId = 'new-canvas';
    await store.removeCanvas('proj-1', 'new-canvas');
    expect(api.deleteCanvas).toHaveBeenCalledWith('proj-1', 'new-canvas');
  });
});
