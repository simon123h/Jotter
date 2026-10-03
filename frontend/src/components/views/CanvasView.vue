<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, onBeforeRouteLeave } from 'vue-router';
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type EdgeChange,
  type NodeDragEvent,
  type NodeChange,
  MarkerType,
  SelectionMode,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import TaskNode from '@/components/canvas/TaskNode.vue';
import TextNode from '@/components/canvas/TextNode.vue';
import GroupNode from '@/components/canvas/GroupNode.vue';
import CanvasEdgeComponent from '@/components/canvas/CanvasEdge.vue';
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue';
import CanvasSidebar from '@/components/canvas/CanvasSidebar.vue';

import { useCanvasStore } from '@/stores/canvas';
import { useProjectStore } from '@/stores/project';
import { useSelectionStore } from '@/stores/selection';
import type { CanvasEdge, Task } from '@/types';

const props = defineProps<{
  tasks?: Task[];
}>();

const route = useRoute();
const canvasStore = useCanvasStore();
const projectStore = useProjectStore();
const selectionStore = useSelectionStore();

const projectId = computed(() => (route.params.projectId as string) || '');
const canvasId = computed(() => (route.params.canvasId as string) || 'main');

const {
  project,
  fitView,
  onConnect,
  onConnectStart,
  onConnectEnd,
  getSelectedNodes,
  removeSelectedNodes,
  getSelectedEdges,
  removeSelectedEdges,
} = useVueFlow();

const boardContainerRef = ref<HTMLElement | null>(null);
const isConnecting = ref(false);

onConnectStart(() => {
  isConnecting.value = true;
});

onConnectEnd(() => {
  isConnecting.value = false;
});

// Convert CanvasNode to Vue Flow Node format
const flowNodes = computed(() => {
  return canvasStore.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    data: {
      ...node,
      task: node.type === 'file' && node.file ? projectStore.tasks.find((t) => t.id === node.file!.replace(/\.md$/, '')) : undefined,
    },
    style: {
      width: node.width ? `${node.width}px` : undefined,
      height: node.type !== 'file' && node.height ? `${node.height}px` : undefined,
      zIndex: node.type === 'group' ? -1 : 1,
    },
  }));
});

// Convert CanvasEdge to Vue Flow Edge format
const flowEdges = computed(() => {
  return canvasStore.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: edge.fromSide || 'right',
    targetHandle: edge.toSide || 'left',
    markerEnd:
      edge.toEnd !== 'none'
        ? {
            type: MarkerType.ArrowClosed,
            color: edge.color || 'var(--color-theme-text-muted, #94a3b8)',
          }
        : undefined,
    markerStart:
      edge.fromEnd === 'arrow'
        ? {
            type: MarkerType.ArrowClosed,
            color: edge.color || 'var(--color-theme-text-muted, #94a3b8)',
          }
        : undefined,
    label: edge.label || undefined,
    style: {
      stroke: edge.color || 'var(--color-theme-text-muted, #94a3b8)',
      strokeWidth: 2,
    },
  }));
});

// Load canvas whenever route params change
const loadCurrentCanvas = async () => {
  if (projectId.value) {
    await canvasStore.fetchCanvases(projectId.value);
    await canvasStore.loadCanvas(projectId.value, canvasId.value);
    if (canvasStore.nodes.length > 0) {
      await nextTick();
      fitView({ padding: 0.2 });
    }
  }
};

// Calculate canvas center coordinates from current viewport
const getViewportCenter = () => {
  if (boardContainerRef.value) {
    const bounds = boardContainerRef.value.getBoundingClientRect();
    return project({
      x: bounds.width / 2,
      y: bounds.height / 2,
    });
  }
  return { x: 200, y: 200 };
};

const handleAddText = () => {
  const center = getViewportCenter();
  const width = 260;
  const height = 160;
  canvasStore.addTextNode(
    'Double-click to edit note...',
    Math.round(center.x - width / 2),
    Math.round(center.y - height / 2),
    width,
    height
  );
};

const handleAddGroup = () => {
  const center = getViewportCenter();
  const width = 400;
  const height = 300;
  canvasStore.addGroupNode('Group Section', Math.round(center.x - width / 2), Math.round(center.y - height / 2), width, height);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.defaultPrevented) return;
  const target = e.target as HTMLElement | null;
  const isInput =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      Boolean((target as any).closest?.('input, textarea, [contenteditable="true"]')));
  if (isInput) return;

  if (e.key === 'v' || e.key === 'V') {
    e.preventDefault();
    canvasStore.toggleInteractionMode();
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    const selectedEdges = getSelectedEdges.value;
    const selectedNodes = getSelectedNodes.value;

    if (selectedEdges.length > 0 || selectedNodes.length > 0) {
      e.preventDefault();

      if (selectedEdges.length > 0) {
        for (const edge of selectedEdges) {
          canvasStore.removeEdge(edge.id);
        }
        removeSelectedEdges(selectedEdges);
      }

      if (selectedNodes.length > 0) {
        for (const node of selectedNodes) {
          canvasStore.removeNode(node.id);
        }
        removeSelectedNodes(selectedNodes);
        selectionStore.clearSelection();
      }
    }
  }
};

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown);
  await loadCurrentCanvas();
});

watch([projectId, canvasId], async (_newVal, oldVal) => {
  if (oldVal && (oldVal[0] || oldVal[1])) {
    await canvasStore.flushAutoSave();
  }
  await loadCurrentCanvas();
});

onBeforeRouteLeave(async () => {
  await canvasStore.flushAutoSave();
});

onBeforeUnmount(async () => {
  window.removeEventListener('keydown', handleKeyDown);
  selectionStore.clearSelection();
  await canvasStore.flushAutoSave();
});

// Handle node drag stop -> update positions in store
const onNodeDragStop = (event: NodeDragEvent) => {
  canvasStore.updateNodePositionAndSize(event.node.id, event.node.position.x, event.node.position.y);
};

// Sync Vue Flow selection (from marquee or node click) to selectionStore
const syncVueFlowSelectionToStore = () => {
  const selectedTaskIds = new Set<string>();
  for (const node of getSelectedNodes.value) {
    if (node.type === 'file') {
      const taskId = (node.data as any)?.task?.id || (node.data as any)?.file?.replace(/\.md$/, '');
      if (taskId) {
        selectedTaskIds.add(taskId);
      }
    }
  }

  selectionStore.selectedIds = selectedTaskIds;
};

// Handle edge connection
onConnect((params: Connection) => {
  if (!params.source || !params.target) return;
  const edgeId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').substring(0, 16)
      : Math.random().toString(16).substring(2, 18);
  const newEdge: CanvasEdge = {
    id: edgeId,
    fromNode: params.source,
    fromSide: (params.sourceHandle as any) || 'right',
    fromEnd: 'none',
    toNode: params.target,
    toSide: (params.targetHandle as any) || 'left',
    toEnd: 'arrow',
  };
  canvasStore.addEdge(newEdge);
});

// Handle edge deletion via backspace/delete
const onEdgesChange = (changes: EdgeChange[]) => {
  for (const c of changes) {
    if (c.type === 'remove') {
      canvasStore.removeEdge(c.id);
    }
  }
};

// Handle node deletion & selection changes
const onNodesChange = (changes: NodeChange[]) => {
  let hasSelectionChange = false;
  for (const c of changes) {
    if (c.type === 'remove') {
      canvasStore.removeNode(c.id);
    } else if (c.type === 'select') {
      hasSelectionChange = true;
    }
  }
  if (hasSelectionChange) {
    syncVueFlowSelectionToStore();
  }
};

const onSelectionEnd = () => {
  syncVueFlowSelectionToStore();
};

const onPaneClick = () => {
  selectionStore.clearSelection();
};

// If selection is cleared externally (e.g. BulkActionBar clear or after bulk action), deselect nodes in VueFlow
watch(
  () => selectionStore.selectedIds.size,
  (newSize) => {
    if (newSize === 0 && getSelectedNodes.value.length > 0) {
      removeSelectedNodes(getSelectedNodes.value);
    }
  }
);

// Drag and drop from unplaced tasks sidebar
const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  const rawData = event.dataTransfer?.getData('application/jotter-task');
  if (!rawData) return;

  try {
    const task: Task = JSON.parse(rawData);
    // Project mouse coordinates to canvas coordinates
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    canvasStore.addFileNode(task, position.x, position.y);
  } catch (err) {
    console.error('Failed to parse dropped task:', err);
  }
};
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-theme-column/10 relative">
    <!-- Top Canvas Toolbar -->
    <CanvasToolbar :project-id="projectId" @add-text="handleAddText" @add-group="handleAddGroup" />

    <!-- Main Canvas Workspace + Unplaced Tasks Drawer -->
    <div class="flex-grow flex overflow-hidden relative">
      <!-- Vue Flow Board -->
      <div ref="boardContainerRef" class="flex-grow h-full relative" @dragover="onDragOver" @drop="onDrop">
        <VueFlow
          :nodes="flowNodes"
          :edges="flowEdges"
          :default-viewport="{ zoom: 1 }"
          :min-zoom="0.2"
          :max-zoom="2.5"
          :fit-view-on-init="true"
          :pan-on-drag="canvasStore.interactionMode === 'pan' ? true : [1, 2]"
          :selection-key-code="canvasStore.interactionMode === 'select' && !isConnecting ? true : false"
          :pan-activation-key-code="'Space'"
          :selection-mode="SelectionMode.Partial"
          @node-drag-stop="onNodeDragStop"
          @edges-change="onEdgesChange"
          @nodes-change="onNodesChange"
          @selection-end="onSelectionEnd"
          @pane-click="onPaneClick"
          class="jotter-flow-board"
          :class="`mode-${canvasStore.interactionMode}`"
        >
          <template #node-file="nodeProps">
            <TaskNode :id="nodeProps.id" :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>

          <template #node-text="nodeProps">
            <TextNode :id="nodeProps.id" :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>

          <template #node-group="nodeProps">
            <GroupNode :id="nodeProps.id" :data="nodeProps.data" :selected="nodeProps.selected" />
          </template>

          <template #edge-default="edgeProps">
            <CanvasEdgeComponent v-bind="edgeProps" />
          </template>

          <Background pattern-color="var(--color-theme-border, #cbd5e1)" :gap="20" />
          <Controls position="bottom-left" />
        </VueFlow>
      </div>

      <!-- Collapsible Unplaced Tasks Sidebar Drawer -->
      <transition name="slide-drawer">
        <CanvasSidebar v-if="canvasStore.isDrawerOpen" :filtered-tasks="props.tasks" />
      </transition>
    </div>
  </div>
</template>

<style>
.jotter-flow-board .vue-flow__edge-path {
  stroke: var(--color-theme-text-muted, #94a3b8);
  stroke-width: 2;
  transition: stroke 0.2s;
}
.jotter-flow-board .vue-flow__edge.selected .vue-flow__edge-path,
.jotter-flow-board .vue-flow__edge:hover .vue-flow__edge-path {
  stroke: var(--color-theme-primary, #6366f1);
  stroke-width: 2.5;
}
.jotter-flow-board .vue-flow__controls {
  background: var(--color-theme-card, #ffffff);
  border: 1px solid var(--color-theme-border, #e2e8f0);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
.jotter-flow-board .vue-flow__controls-button {
  background: transparent;
  border-bottom: 1px solid var(--color-theme-border, #e2e8f0);
  color: var(--color-theme-text-muted, #64748b);
}
.jotter-flow-board .vue-flow__controls-button:hover {
  background: var(--color-theme-column, #f1f5f9);
  color: var(--color-theme-text-main, #0f172a);
}

.slide-drawer-enter-active,
.slide-drawer-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.slide-drawer-enter-from,
.slide-drawer-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.jotter-flow-board.mode-pan .vue-flow__pane {
  cursor: grab;
}
.jotter-flow-board.mode-pan .vue-flow__pane:active {
  cursor: grabbing;
}
.jotter-flow-board.mode-select .vue-flow__pane {
  cursor: crosshair;
}

/* Broaden resize hover target / border area for node resizer */
.vue-flow__resize-control.line {
  /* Increase invisible border hitbox so the resize cursor activates easily */
  position: absolute;
  z-index: 20;
}
.vue-flow__resize-control.line.top,
.vue-flow__resize-control.line.bottom {
  height: 10px !important;
}
.vue-flow__resize-control.line.top {
  top: 0 !important;
  transform: translate(0, -50%) !important;
}
.vue-flow__resize-control.line.bottom {
  top: 100% !important;
  transform: translate(0, -50%) !important;
}
.vue-flow__resize-control.line.left,
.vue-flow__resize-control.line.right {
  width: 10px !important;
}
.vue-flow__resize-control.line.left {
  left: 0 !important;
  transform: translate(-50%, 0) !important;
}
.vue-flow__resize-control.line.right {
  left: 100% !important;
  transform: translate(-50%, 0) !important;
}

/* Enlarge corner handle hitbox */
.vue-flow__resize-control.handle {
  width: 10px !important;
  height: 10px !important;
  z-index: 21;
}
.vue-flow__resize-control.handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 22px;
  height: 22px;
  transform: translate(-50%, -50%);
}
</style>
