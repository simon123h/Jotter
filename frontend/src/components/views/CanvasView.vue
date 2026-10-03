<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue';
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
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue';
import CanvasSidebar from '@/components/canvas/CanvasSidebar.vue';

import { useCanvasStore } from '@/stores/canvas';
import { useProjectStore } from '@/stores/project';
import type { CanvasEdge, Task } from '@/types';

const route = useRoute();
const canvasStore = useCanvasStore();
const projectStore = useProjectStore();

const projectId = computed(() => (route.params.projectId as string) || '');
const canvasId = computed(() => (route.params.canvasId as string) || 'main');

const { project, onConnect } = useVueFlow();

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
      height: node.height ? `${node.height}px` : undefined,
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
    markerEnd: edge.toEnd !== 'none' ? MarkerType.ArrowClosed : undefined,
    markerStart: edge.fromEnd === 'arrow' ? MarkerType.ArrowClosed : undefined,
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
  }
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
  await canvasStore.flushAutoSave();
});

// Handle node drag stop -> update positions in store
const onNodeDragStop = (event: NodeDragEvent) => {
  canvasStore.updateNodePositionAndSize(event.node.id, event.node.position.x, event.node.position.y);
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

// Handle node deletion
const onNodesChange = (changes: NodeChange[]) => {
  for (const c of changes) {
    if (c.type === 'remove') {
      canvasStore.removeNode(c.id);
    }
  }
};

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
    <CanvasToolbar :project-id="projectId" />

    <!-- Main Canvas Workspace + Unplaced Tasks Drawer -->
    <div class="flex-grow flex overflow-hidden relative">
      <!-- Vue Flow Board -->
      <div class="flex-grow h-full relative" @dragover="onDragOver" @drop="onDrop">
        <VueFlow
          :nodes="flowNodes"
          :edges="flowEdges"
          :default-viewport="{ zoom: 1 }"
          :min-zoom="0.2"
          :max-zoom="2.5"
          :fit-view-on-init="false"
          :pan-on-drag="canvasStore.interactionMode === 'pan' ? true : [1, 2]"
          :selection-key-code="canvasStore.interactionMode === 'select' ? true : false"
          :pan-activation-key-code="'Space'"
          :selection-mode="SelectionMode.Partial"
          @node-drag-stop="onNodeDragStop"
          @edges-change="onEdgesChange"
          @nodes-change="onNodesChange"
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

          <Background pattern-color="var(--color-theme-border, #cbd5e1)" :gap="20" />
          <Controls position="bottom-left" />
        </VueFlow>
      </div>

      <!-- Collapsible Unplaced Tasks Sidebar Drawer -->
      <transition name="slide-drawer">
        <CanvasSidebar v-if="canvasStore.isDrawerOpen" />
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
</style>
