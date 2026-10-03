<script setup lang="ts">
import { ref } from 'vue';
import { NodeResizer } from '@vue-flow/node-resizer';
import '@vue-flow/node-resizer/dist/style.css';
import { Trash2, Edit2, Check, Palette } from '@lucide/vue';
import { useCanvasStore } from '@/stores/canvas';
import { CANVAS_COLORS } from '@/constants/canvasColors';

const props = defineProps<{
  id: string;
  data: {
    label?: string;
    color?: string | null;
    background?: string | null;
  };
  selected?: boolean;
}>();

const canvasStore = useCanvasStore();

const isEditingLabel = ref(false);
const labelValue = ref(props.data.label || 'Group');

const cycleColor = () => {
  const currentColor = props.data.color || null;
  const currentIndex = CANVAS_COLORS.findIndex((c) => c.value === currentColor);
  const nextIndex = (currentIndex + 1) % CANVAS_COLORS.length;
  canvasStore.updateNodeData(props.id, { color: CANVAS_COLORS[nextIndex].value });
};

const startEditLabel = () => {
  labelValue.value = props.data.label || 'Group';
  isEditingLabel.value = true;
};

const saveLabel = () => {
  isEditingLabel.value = false;
  canvasStore.updateNodeData(props.id, { label: labelValue.value });
};

const removeNode = () => {
  canvasStore.removeNode(props.id);
};

const onResize = (event: any) => {
  canvasStore.updateNodePositionAndSize(props.id, event.x, event.y, event.width, event.height);
};
</script>

<template>
  <div
    class="canvas-group-node relative group rounded-xl border-2 transition-colors pointer-events-auto h-full w-full flex flex-col"
    :class="[
      selected ? 'border-theme-primary/80 ring-2 ring-theme-primary/20' : 'border-dashed border-theme-border/70 hover:border-theme-border',
      data.color ? 'custom-border' : '',
    ]"
    :style="{
      backgroundColor: data.background || 'rgba(var(--color-theme-column-rgb, 120, 120, 120), 0.05)',
      borderColor: data.color || undefined,
    }"
  >
    <NodeResizer
      :min-width="150"
      :min-height="100"
      :is-visible="selected"
      line-class-name="border-theme-primary"
      handle-class-name="bg-theme-primary border-2 border-white rounded-sm w-2.5 h-2.5"
      @resize-end="onResize"
    />

    <!-- Header bar with label and actions -->
    <div class="flex items-center justify-between px-3 py-2 select-none border-b border-theme-border/20">
      <div class="flex items-center gap-1.5 flex-grow">
        <template v-if="isEditingLabel">
          <input
            v-model="labelValue"
            @blur="saveLabel"
            @keydown.enter="saveLabel"
            class="px-1.5 py-0.5 text-xs font-bold bg-theme-column/80 border border-theme-border rounded text-theme-text-main focus:outline-none focus:ring-1 focus:ring-theme-primary"
            autoFocus
          />
          <button @click="saveLabel" class="text-theme-primary p-0.5 hover:opacity-80">
            <Check class="w-3.5 h-3.5" />
          </button>
        </template>
        <template v-else>
          <span
            @dblclick="startEditLabel"
            class="text-xs font-bold text-theme-text-muted hover:text-theme-text-main transition-colors cursor-text"
          >
            {{ data.label || 'Group' }}
          </span>
          <button
            @click="startEditLabel"
            class="text-theme-text-muted opacity-0 group-hover:opacity-100 hover:text-theme-text-main p-0.5 transition-opacity cursor-pointer"
          >
            <Edit2 class="w-3 h-3" />
          </button>
        </template>
      </div>

      <div class="flex items-center gap-1">
        <!-- Color cycle button -->
        <button
          type="button"
          @click.stop="cycleColor"
          title="Change Group Border Color"
          class="text-theme-text-muted opacity-0 group-hover:opacity-100 hover:text-theme-primary p-0.5 transition-opacity cursor-pointer flex items-center gap-1"
        >
          <Palette class="w-3.5 h-3.5" />
          <span v-if="data.color" class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: data.color }" />
        </button>

        <button
          @click.stop="removeNode"
          title="Delete group"
          class="text-theme-text-muted opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 transition-opacity cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Body placeholder (transparent click-through backdrop) -->
    <div class="flex-grow"></div>
  </div>
</template>

<style scoped>
.canvas-group-node {
  min-width: 150px;
  min-height: 100px;
}
</style>
