import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { CanvasDocument, CanvasMeta, CanvasNode, CanvasEdge, Task } from '@/types';
import { getCanvases, getCanvas, saveCanvas, deleteCanvas } from '@/api';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { crossTabBus } from '@/utils/broadcast';

export const useCanvasStore = defineStore('canvas', () => {
  const currentProjectId = ref<string>('');
  const activeCanvasId = ref<string>('main');
  const canvases = ref<CanvasMeta[]>([]);
  const currentDocument = ref<CanvasDocument>({ nodes: [], edges: [] });
  const isDrawerOpen = ref<boolean>(false);
  const isLoading = ref<boolean>(false);
  const isSaving = ref<boolean>(false);
  const saveTimeout = ref<any>(null);
  const interactionMode = ref<'pan' | 'select'>('pan');

  const toggleInteractionMode = () => {
    interactionMode.value = interactionMode.value === 'pan' ? 'select' : 'pan';
  };

  const toast = useToast();
  const { t } = useI18n();

  // Nodes & edges computed accessors
  const nodes = computed(() => currentDocument.value.nodes);
  const edges = computed(() => currentDocument.value.edges);

  // Set of task IDs present on current canvas as file nodes
  const placedTaskIdSet = computed(() => {
    const set = new Set<string>();
    for (const node of currentDocument.value.nodes) {
      if (node.type === 'file' && node.file) {
        // file is "<taskId>.md" or "<taskId>"
        const id = node.file.replace(/\.md$/, '');
        set.add(id);
      }
    }
    return set;
  });

  const isTaskPlaced = computed(() => (taskId: string) => {
    return placedTaskIdSet.value.has(taskId);
  });

  // Load canvases list for a project
  const fetchCanvases = async (projectId: string) => {
    if (!projectId) return;
    try {
      canvases.value = await getCanvases(projectId);
      if (canvases.value.length === 0) {
        // default empty canvas list representation
        canvases.value = [{ id: 'main', title: 'main' }];
      }
    } catch (err: any) {
      console.error('Failed to fetch canvases:', err);
    }
  };

  // Load a specific canvas document
  const loadCanvas = async (projectId: string, canvasId: string) => {
    currentProjectId.value = projectId;
    activeCanvasId.value = canvasId || 'main';
    isLoading.value = true;
    try {
      const doc = await getCanvas(projectId, activeCanvasId.value);
      currentDocument.value = {
        nodes: doc.nodes || [],
        edges: doc.edges || [],
      };
    } catch (err: any) {
      console.warn('Canvas not found or error loading, initializing empty canvas:', err);
      currentDocument.value = { nodes: [], edges: [] };
    } finally {
      isLoading.value = false;
    }
  };

  const generateCanvasId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    }
    return Math.random().toString(16).substring(2, 18);
  };

  // Trigger debounced auto-save (e.g. 500ms after node drag or edit)
  const triggerAutoSave = () => {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
    }
    saveTimeout.value = setTimeout(async () => {
      await persistCanvas();
    }, 500);
  };

  // Cancel any pending debounced auto-save without saving
  const cancelAutoSave = () => {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
      saveTimeout.value = null;
    }
  };

  // Flush pending auto-save immediately
  const flushAutoSave = async () => {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
      saveTimeout.value = null;
      await persistCanvas();
    }
  };

  // Save current canvas immediately
  const persistCanvas = async () => {
    if (!currentProjectId.value || !activeCanvasId.value) return;
    isSaving.value = true;
    try {
      // Ensure all nodes have valid numeric coordinates and dimensions
      const sanitizedDoc: CanvasDocument = {
        ...currentDocument.value,
        nodes: currentDocument.value.nodes.map((node) => ({
          ...node,
          x: typeof node.x === 'number' && !isNaN(node.x) ? Math.round(node.x) : 0,
          y: typeof node.y === 'number' && !isNaN(node.y) ? Math.round(node.y) : 0,
          width: typeof node.width === 'number' && !isNaN(node.width) ? Math.round(node.width) : 200,
          height: typeof node.height === 'number' && !isNaN(node.height) ? Math.round(node.height) : 120,
        })),
      };
      await saveCanvas(currentProjectId.value, activeCanvasId.value, sanitizedDoc);
    } catch (err: any) {
      console.error('Failed to save canvas:', err);
      toast.error(t('canvas.saveError') || 'Failed to save canvas');
    } finally {
      isSaving.value = false;
    }
  };

  // Create a new canvas
  const createNewCanvas = async (projectId: string, name: string): Promise<string> => {
    const slug =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-') || 'canvas';
    const initialDoc: CanvasDocument = { nodes: [], edges: [] };
    await saveCanvas(projectId, slug, initialDoc);
    await fetchCanvases(projectId);
    return slug;
  };

  // Remove a canvas
  const removeCanvas = async (projectId: string, canvasId: string) => {
    await deleteCanvas(projectId, canvasId);
    await fetchCanvases(projectId);
    if (activeCanvasId.value === canvasId) {
      const fallback = canvases.value[0]?.id || 'main';
      await loadCanvas(projectId, fallback);
    }
  };

  // Node operations
  const addFileNode = (task: Task, x: number, y: number, width = 280, height = 140) => {
    const nodeId = generateCanvasId();
    const newNode: CanvasNode = {
      id: nodeId,
      type: 'file',
      file: `${task.id}.md`,
      x,
      y,
      width,
      height,
      color: task.color || null,
    };
    currentDocument.value.nodes.push(newNode);
    triggerAutoSave();
    return newNode;
  };

  const addTextNode = (text = '', x: number, y: number, width = 260, height = 160) => {
    const nodeId = generateCanvasId();
    const newNode: CanvasNode = {
      id: nodeId,
      type: 'text',
      text,
      x,
      y,
      width,
      height,
    };
    currentDocument.value.nodes.push(newNode);
    triggerAutoSave();
    return newNode;
  };

  const addGroupNode = (label = 'New Group', x: number, y: number, width = 400, height = 300) => {
    const nodeId = generateCanvasId();
    const newNode: CanvasNode = {
      id: nodeId,
      type: 'group',
      label,
      x,
      y,
      width,
      height,
    };
    currentDocument.value.nodes.push(newNode);
    triggerAutoSave();
    return newNode;
  };

  const updateNodePositionAndSize = (id: string, x?: number | null, y?: number | null, width?: number | null, height?: number | null) => {
    const node = currentDocument.value.nodes.find((n) => n.id === id);
    if (node) {
      if (typeof x === 'number' && !isNaN(x)) node.x = Math.round(x);
      if (typeof y === 'number' && !isNaN(y)) node.y = Math.round(y);
      if (typeof width === 'number' && !isNaN(width)) node.width = Math.round(width);
      if (typeof height === 'number' && !isNaN(height)) node.height = Math.round(height);
      triggerAutoSave();
    }
  };

  const updateNodeData = (id: string, updates: Partial<CanvasNode>) => {
    const node = currentDocument.value.nodes.find((n) => n.id === id);
    if (node) {
      Object.assign(node, updates);
      triggerAutoSave();
    }
  };

  const removeNode = (id: string) => {
    currentDocument.value.nodes = currentDocument.value.nodes.filter((n) => n.id !== id);
    // Also remove connected edges
    currentDocument.value.edges = currentDocument.value.edges.filter((e) => e.fromNode !== id && e.toNode !== id);
    triggerAutoSave();
  };

  // Edge operations
  const addEdge = (edge: CanvasEdge) => {
    // Avoid duplicate edge
    const exists = currentDocument.value.edges.some(
      (e) => e.fromNode === edge.fromNode && e.toNode === edge.toNode && e.fromSide === edge.fromSide && e.toSide === edge.toSide
    );
    if (!exists) {
      currentDocument.value.edges.push(edge);
      triggerAutoSave();
    }
  };

  const updateEdge = (id: string, updates: Partial<CanvasEdge>) => {
    const edge = currentDocument.value.edges.find((e) => e.id === id);
    if (edge) {
      Object.assign(edge, updates);
      triggerAutoSave();
    }
  };

  const reverseEdge = (id: string) => {
    const edge = currentDocument.value.edges.find((e) => e.id === id);
    if (edge) {
      const prevFromNode = edge.fromNode;
      const prevFromSide = edge.fromSide;

      edge.fromNode = edge.toNode;
      edge.fromSide = edge.toSide;

      edge.toNode = prevFromNode;
      edge.toSide = prevFromSide;

      // Trigger array re-assignment for Vue Flow reactivity
      currentDocument.value.edges = [...currentDocument.value.edges];
      triggerAutoSave();
    }
  };

  const removeEdge = (id: string) => {
    currentDocument.value.edges = currentDocument.value.edges.filter((e) => e.id !== id);
    triggerAutoSave();
  };

  const toggleDrawer = () => {
    isDrawerOpen.value = !isDrawerOpen.value;
  };

  // Subscribe to cross-tab updates
  crossTabBus.subscribe((event) => {
    if (event.type === 'canvas-changed' && event.projectId === currentProjectId.value) {
      if (event.canvasId === activeCanvasId.value) {
        // Silently reload without spinner to avoid jarring layout shifts
        getCanvas(currentProjectId.value, activeCanvasId.value)
          .then((doc) => {
            currentDocument.value = doc;
          })
          .catch(() => {});
      }
      fetchCanvases(currentProjectId.value);
    }
  });

  return {
    currentProjectId,
    activeCanvasId,
    canvases,
    currentDocument,
    isDrawerOpen,
    isLoading,
    isSaving,
    nodes,
    edges,
    placedTaskIdSet,
    isTaskPlaced,
    fetchCanvases,
    loadCanvas,
    persistCanvas,
    triggerAutoSave,
    cancelAutoSave,
    flushAutoSave,
    createNewCanvas,
    removeCanvas,
    addFileNode,
    addTextNode,
    addGroupNode,
    updateNodePositionAndSize,
    updateNodeData,
    removeNode,
    addEdge,
    updateEdge,
    reverseEdge,
    removeEdge,
    toggleDrawer,
    interactionMode,
    toggleInteractionMode,
  };
});
