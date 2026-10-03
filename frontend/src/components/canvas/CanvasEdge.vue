<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, type EdgeProps } from '@vue-flow/core';
import { ArrowRight, ArrowLeftRight, Minus, Repeat, Palette, Trash2 } from '@lucide/vue';
import { useCanvasStore } from '@/stores/canvas';

const props = defineProps<EdgeProps>();

const canvasStore = useCanvasStore();

const pathData = computed(() => {
  return getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition ?? Position.Right,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition ?? Position.Left,
  });
});

const currentEdge = computed(() => {
  return canvasStore.edges.find((e) => e.id === props.id);
});

const edgeColor = computed(() => {
  return currentEdge.value?.color || props.style?.stroke || 'var(--color-theme-text-muted, #94a3b8)';
});

// Tip states: 'arrow' (unidirectional ->), 'bidirectional' (<->), 'none' (---)
const currentTipMode = computed<'arrow' | 'bidirectional' | 'none'>(() => {
  const edge = currentEdge.value;
  if (!edge) return 'arrow';
  if (edge.fromEnd === 'arrow' && edge.toEnd === 'arrow') return 'bidirectional';
  if (edge.toEnd === 'none' && edge.fromEnd !== 'arrow') return 'none';
  return 'arrow';
});

const cycleTips = () => {
  const edge = currentEdge.value;
  if (!edge) return;
  if (currentTipMode.value === 'arrow') {
    // -> arrow to bidirectional
    canvasStore.updateEdge(props.id, { fromEnd: 'arrow', toEnd: 'arrow' });
  } else if (currentTipMode.value === 'bidirectional') {
    // bidirectional to none
    canvasStore.updateEdge(props.id, { fromEnd: 'none', toEnd: 'none' });
  } else {
    // none to unidirectional arrow
    canvasStore.updateEdge(props.id, { fromEnd: 'none', toEnd: 'arrow' });
  }
};

const flipDirection = () => {
  canvasStore.reverseEdge(props.id);
};

const deleteEdge = () => {
  canvasStore.removeEdge(props.id);
};

const colorPalette = [
  { name: 'Default', value: null, bg: 'bg-slate-400' },
  { name: 'Red', value: '#ef4444', bg: 'bg-rose-500' },
  { name: 'Orange', value: '#f97316', bg: 'bg-amber-600' },
  { name: 'Yellow', value: '#eab308', bg: 'bg-yellow-500' },
  { name: 'Green', value: '#22c55e', bg: 'bg-emerald-500' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Purple', value: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Pink', value: '#ec4899', bg: 'bg-pink-500' },
];

const cycleColor = () => {
  const currentColor = currentEdge.value?.color || null;
  const currentIndex = colorPalette.findIndex((c) => c.value === currentColor);
  const nextIndex = (currentIndex + 1) % colorPalette.length;
  canvasStore.updateEdge(props.id, { color: colorPalette[nextIndex].value });
};
</script>

<template>
  <g class="canvas-custom-edge" :class="{ 'is-selected': selected }">
    <BaseEdge
      :id="id"
      :path="pathData[0]"
      :marker-start="markerStart"
      :marker-end="markerEnd"
      :style="{
        ...style,
        stroke: edgeColor,
        strokeWidth: selected ? 2.5 : 2,
      }"
    />

    <EdgeLabelRenderer>
      <div
        v-if="selected"
        :style="{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${pathData[1]}px,${pathData[2]}px)`,
          pointerEvents: 'all',
        }"
        class="nodrag nopan flex items-center gap-1 bg-theme-card/95 border border-theme-border shadow-md rounded-lg p-1 z-20 backdrop-blur text-xs"
        @click.stop
        @mousedown.stop
      >
        <!-- Tip mode toggle -->
        <button
          type="button"
          @click="cycleTips"
          :title="`Cycle Arrowhead Tips (Current: ${currentTipMode})`"
          class="p-1.5 rounded hover:bg-theme-column/80 text-theme-text-main transition-colors cursor-pointer"
        >
          <ArrowRight v-if="currentTipMode === 'arrow'" class="w-3.5 h-3.5" />
          <ArrowLeftRight v-else-if="currentTipMode === 'bidirectional'" class="w-3.5 h-3.5 text-theme-primary" />
          <Minus v-else class="w-3.5 h-3.5" />
        </button>

        <!-- Flip direction button -->
        <button
          type="button"
          @click="flipDirection"
          title="Reverse Direction"
          class="p-1.5 rounded hover:bg-theme-column/80 text-theme-text-main transition-colors cursor-pointer"
        >
          <Repeat class="w-3.5 h-3.5" />
        </button>

        <!-- Color cycle picker -->
        <button
          type="button"
          @click="cycleColor"
          title="Cycle Color"
          class="p-1.5 rounded hover:bg-theme-column/80 text-theme-text-main transition-colors cursor-pointer flex items-center gap-1"
        >
          <Palette class="w-3.5 h-3.5" />
          <span v-if="currentEdge?.color" class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: currentEdge.color }" />
        </button>

        <!-- Divider -->
        <div class="h-3.5 w-[1px] bg-theme-border my-auto mx-0.5"></div>

        <!-- Delete button -->
        <button
          type="button"
          @click="deleteEdge"
          title="Delete Arrow (Del)"
          class="p-1.5 rounded hover:bg-rose-500/10 text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </EdgeLabelRenderer>
  </g>
</template>

<style scoped>
.canvas-custom-edge.is-selected :deep(.vue-flow__edge-path) {
  stroke: var(--color-theme-primary, #6366f1) !important;
}
</style>
