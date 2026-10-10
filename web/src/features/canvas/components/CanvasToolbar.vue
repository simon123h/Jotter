<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, Trash2, FolderOpen, Type, Square, PanelRightOpen, PanelRightClose, Loader2, Check, Hand, MousePointer } from '@lucide/vue';
import { useCanvasStore } from '@/features/canvas/stores/canvas';

const props = defineProps<{
  projectId: string;
}>();

const router = useRouter();
const canvasStore = useCanvasStore();

const showNewCanvasInput = ref(false);
const newCanvasName = ref('');

const activeCanvas = computed(() => canvasStore.activeCanvasId);

const selectCanvas = (canvasId: string) => {
  router.push({
    name: 'canvas',
    params: {
      projectId: props.projectId,
      canvasId,
    },
  });
};

const handleCreateCanvas = async () => {
  if (!newCanvasName.value.trim()) return;
  const newId = await canvasStore.createNewCanvas(props.projectId, newCanvasName.value.trim());
  newCanvasName.value = '';
  showNewCanvasInput.value = false;
  selectCanvas(newId);
};

const handleDeleteCurrentCanvas = async () => {
  if (canvasStore.canvases.length <= 1) return;
  if (!confirm(`Delete canvas "${activeCanvas.value}"?`)) return;
  await canvasStore.removeCanvas(props.projectId, activeCanvas.value);
  selectCanvas(canvasStore.canvases[0]?.id || 'main');
};

const emit = defineEmits<{
  (e: 'add-text'): void;
  (e: 'add-group'): void;
}>();

const addText = () => {
  emit('add-text');
};

const addGroup = () => {
  emit('add-group');
};
</script>

<template>
  <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-theme-border bg-theme-card select-none text-xs">
    <!-- Left: Canvas Selection Dropdown / Management -->
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1.5 font-bold text-theme-text-main">
        <FolderOpen class="w-4 h-4 text-theme-primary shrink-0" />
        <span class="hidden sm:inline">Canvas:</span>
      </div>

      <!-- Selector dropdown -->
      <select
        :value="activeCanvas"
        @change="selectCanvas(($event.target as HTMLSelectElement).value)"
        class="bg-theme-column/50 border border-theme-border rounded px-2 py-1 text-theme-text-main focus:outline-none focus:ring-1 focus:ring-theme-primary cursor-pointer font-medium"
      >
        <option v-for="c in canvasStore.canvases" :key="c.id" :value="c.id">
          {{ c.title || c.id }}
        </option>
      </select>

      <!-- New Canvas Button / Input -->
      <template v-if="!showNewCanvasInput">
        <button
          @click="showNewCanvasInput = true"
          title="Create canvas"
          class="p-1 rounded text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column transition-colors cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
      </template>
      <div v-else class="flex items-center gap-1">
        <input
          v-model="newCanvasName"
          @keydown.enter="handleCreateCanvas"
          @keydown.esc="showNewCanvasInput = false"
          placeholder="Canvas name..."
          class="px-1.5 py-0.5 text-xs bg-theme-column border border-theme-border rounded text-theme-text-main focus:outline-none focus:ring-1 focus:ring-theme-primary w-28"
          autoFocus
        />
        <button @click="handleCreateCanvas" class="p-1 rounded text-theme-primary hover:bg-theme-column transition-colors cursor-pointer">
          <Check class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Delete Canvas Button (if more than 1) -->
      <button
        v-if="canvasStore.canvases.length > 1"
        @click="handleDeleteCurrentCanvas"
        title="Delete current canvas"
        class="p-1 rounded text-theme-text-muted hover:text-rose-500 hover:bg-theme-column transition-colors cursor-pointer"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>

      <!-- Saving Indicator -->
      <span v-if="canvasStore.isSaving" class="flex items-center gap-1 text-[11px] text-theme-text-muted ml-2">
        <Loader2 class="w-3 h-3 animate-spin text-theme-primary" />
        <span>Saving...</span>
      </span>
    </div>

    <!-- Right: Insert tools & Drawer toggle -->
    <div class="flex items-center gap-2">
      <!-- Interaction Mode Toggle (Pan vs Select) -->
      <div class="flex items-center rounded bg-theme-column/60 border border-theme-border p-0.5">
        <button
          @click="canvasStore.interactionMode = 'pan'"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
          :class="
            canvasStore.interactionMode === 'pan'
              ? 'bg-theme-primary text-white shadow-xs'
              : 'text-theme-text-muted hover:text-theme-text-main'
          "
          title="Pan / Move mode (V or hold Space to pan)"
        >
          <Hand class="w-3.5 h-3.5" />
          <span class="hidden md:inline">Pan</span>
        </button>
        <button
          @click="canvasStore.interactionMode = 'select'"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
          :class="
            canvasStore.interactionMode === 'select'
              ? 'bg-theme-primary text-white shadow-xs'
              : 'text-theme-text-muted hover:text-theme-text-main'
          "
          title="Select / Marquee mode (V)"
        >
          <MousePointer class="w-3.5 h-3.5" />
          <span class="hidden md:inline">Select</span>
        </button>
      </div>

      <!-- Divider -->
      <div class="h-4 w-[1px] bg-theme-border mx-0.5"></div>

      <!-- Insert Text Node -->
      <button
        @click="addText"
        class="flex items-center gap-1 px-2 py-1 rounded bg-theme-column/60 border border-theme-border hover:bg-theme-column hover:text-theme-primary text-theme-text-main transition-colors cursor-pointer font-medium"
      >
        <Type class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">Add Text</span>
      </button>

      <!-- Insert Group Node -->
      <button
        @click="addGroup"
        class="flex items-center gap-1 px-2 py-1 rounded bg-theme-column/60 border border-theme-border hover:bg-theme-column hover:text-theme-primary text-theme-text-main transition-colors cursor-pointer font-medium"
      >
        <Square class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">Add Group</span>
      </button>

      <!-- Divider -->
      <div class="h-4 w-[1px] bg-theme-border mx-1"></div>

      <!-- Drawer toggle button -->
      <button
        @click="canvasStore.toggleDrawer"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors cursor-pointer font-medium border"
        :class="
          canvasStore.isDrawerOpen
            ? 'bg-theme-primary text-white border-theme-primary'
            : 'bg-theme-column/60 border-theme-border text-theme-text-main hover:bg-theme-column'
        "
        :title="canvasStore.isDrawerOpen ? 'Close unplaced tasks drawer' : 'Open unplaced tasks drawer'"
      >
        <component :is="canvasStore.isDrawerOpen ? PanelRightClose : PanelRightOpen" class="w-4 h-4" />
        <span class="hidden sm:inline">Tasks Drawer</span>
      </button>
    </div>
  </div>
</template>
