<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { NodeResizer } from '@vue-flow/node-resizer';
import '@vue-flow/node-resizer/dist/style.css';
import { Trash2, Edit3, Check, Palette } from '@lucide/vue';
import { marked } from 'marked';
import { useCanvasStore } from '@/features/canvas/stores/canvas';
import { CANVAS_COLORS } from '@/features/canvas/constants/canvasColors';

const props = defineProps<{
  id: string;
  data: {
    text?: string;
    color?: string | null;
  };
  selected?: boolean;
}>();

const canvasStore = useCanvasStore();

const isEditing = ref(false);
const textValue = ref(props.data.text || '');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const cycleColor = () => {
  const currentColor = props.data.color || null;
  const currentIndex = CANVAS_COLORS.findIndex((c) => c.value === currentColor);
  const nextIndex = (currentIndex + 1) % CANVAS_COLORS.length;
  canvasStore.updateNodeData(props.id, { color: CANVAS_COLORS[nextIndex].value });
};

const renderedMarkdown = computed(() => {
  if (!props.data.text) return '<p class="italic opacity-60">Empty note. Double-click or click edit to write...</p>';
  return marked.parse(props.data.text);
});

const startEditing = async () => {
  textValue.value = props.data.text || '';
  isEditing.value = true;
  await nextTick();
  textareaRef.value?.focus();
};

const saveEditing = () => {
  isEditing.value = false;
  canvasStore.updateNodeData(props.id, { text: textValue.value });
};

const removeNode = () => {
  canvasStore.removeNode(props.id);
};

const onResize = (event: any) => {
  const params = event?.params || event;
  if (!params) return;
  canvasStore.updateNodePositionAndSize(props.id, params.x, params.y, params.width, params.height);
};
</script>

<template>
  <div
    class="canvas-text-node relative group rounded-lg shadow-sm transition-shadow border-2 bg-theme-card p-3 w-full h-full min-w-[60px] min-h-[40px] flex flex-col"
    :class="[
      selected ? 'border-theme-primary ring-2 ring-theme-primary/20' : 'border-theme-border/60 hover:border-theme-border',
      data.color ? 'custom-colored' : '',
    ]"
    :style="data.color ? { borderColor: data.color } : {}"
    @dblclick="startEditing"
  >
    <NodeResizer
      :min-width="60"
      :min-height="40"
      :is-visible="selected"
      line-class-name="border-theme-primary"
      handle-class-name="bg-theme-primary border-2 border-white rounded-sm w-2.5 h-2.5"
      @resize-end="onResize"
    />
    <!-- Vue Flow Connection Handles -->
    <Handle id="top" type="source" :position="Position.Top" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />
    <Handle id="right" type="source" :position="Position.Right" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />
    <Handle id="bottom" type="source" :position="Position.Bottom" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />
    <Handle id="left" type="source" :position="Position.Left" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />

    <!-- Node Toolbar Controls -->
    <div
      class="absolute -top-3.5 right-2 hidden group-hover:flex items-center gap-1 bg-theme-column/90 border border-theme-border shadow-sm rounded-md px-1.5 py-0.5 z-10 text-xs backdrop-blur"
    >
      <button
        v-if="!isEditing"
        @click.stop="startEditing"
        title="Edit text"
        class="text-theme-text-muted hover:text-theme-primary transition-colors cursor-pointer p-0.5"
      >
        <Edit3 class="w-3.5 h-3.5" />
      </button>
      <button
        v-else
        @click.stop="saveEditing"
        title="Done"
        class="text-theme-primary hover:text-theme-primary transition-colors cursor-pointer p-0.5 font-bold"
      >
        <Check class="w-3.5 h-3.5" />
      </button>

      <!-- Color cycle button -->
      <button
        type="button"
        @click.stop="cycleColor"
        title="Change Note Color"
        class="text-theme-text-muted hover:text-theme-primary transition-colors cursor-pointer p-0.5 flex items-center gap-1"
      >
        <Palette class="w-3.5 h-3.5" />
        <span v-if="data.color" class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: data.color }" />
      </button>

      <button
        @click.stop="removeNode"
        title="Remove"
        class="text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer p-0.5"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Content Area -->
    <div class="flex-grow overflow-auto text-sm text-theme-text-main">
      <textarea
        v-if="isEditing"
        ref="textareaRef"
        v-model="textValue"
        @blur="saveEditing"
        @keydown.esc="saveEditing"
        class="w-full h-full min-h-[30px] p-1.5 text-xs bg-theme-column/40 border border-theme-border rounded focus:outline-none focus:ring-1 focus:ring-theme-primary resize-none"
        placeholder="Type markdown note..."
      ></textarea>
      <div v-else class="prose prose-xs max-w-none text-xs text-theme-text-main break-words" v-html="renderedMarkdown"></div>
    </div>
  </div>
</template>

<style scoped>
.canvas-text-node {
  min-width: 60px;
  min-height: 40px;
}
.vue-flow-handle {
  width: 12px;
  height: 12px;
  background-color: var(--color-theme-primary, #6366f1);
  border: 2px solid white;
  border-radius: 50%;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  z-index: 10;
}
/* Generous hitbox for easy hover and arrow creation */
.vue-flow-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.canvas-text-node:hover .vue-flow-handle,
.canvas-text-node.selected .vue-flow-handle {
  opacity: 1;
}
</style>
