<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { X, SlidersHorizontal, Calendar, Tag, Trash2 } from '@lucide/vue';
import { useI18n } from '../../composables/useI18n';
import { useSettingsStore } from '../../stores/settings';
import type { Bucket, TaskFilterParams } from '../../types';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  buckets: Bucket[];
  allTags: string[];
  currentFilters: TaskFilterParams;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply', filters: TaskFilterParams): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);

const settingsStore = useSettingsStore();

// Local state for filters
const search = ref('');
const selectedBuckets = ref<string[]>([]);
const selectedPriorities = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const tagMode = ref<'any' | 'all'>('any');
const dueDateStatus = ref<'all' | 'has' | 'none'>('all');
const dueAfter = ref('');
const dueBefore = ref('');
const hideDoneColumnLocal = ref(false);

// Watch for isOpen changes to call showModal() / close()
watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      // Initialize local state from currentFilters
      search.value = props.currentFilters.search || '';

      selectedBuckets.value = props.currentFilters.buckets
        ? props.currentFilters.buckets
            .split(',')
            .map((b) => b.trim())
            .filter(Boolean)
        : [];

      selectedPriorities.value = props.currentFilters.priorities
        ? props.currentFilters.priorities
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : [];

      selectedTags.value = props.currentFilters.tags
        ? props.currentFilters.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      tagMode.value = props.currentFilters.tag_mode || 'any';

      if (props.currentFilters.has_due_date === true) {
        dueDateStatus.value = 'has';
      } else if (props.currentFilters.has_due_date === false) {
        dueDateStatus.value = 'none';
      } else {
        dueDateStatus.value = 'all';
      }

      dueAfter.value = props.currentFilters.due_after || '';
      dueBefore.value = props.currentFilters.due_before || '';
      hideDoneColumnLocal.value = settingsStore.hideDoneColumn;

      await nextTick();
      if (dialogRef.value && !dialogRef.value.open) {
        dialogRef.value.showModal();
      }
    } else {
      await nextTick();
      if (dialogRef.value && dialogRef.value.open) {
        dialogRef.value.close();
      }
    }
  },
  { immediate: true }
);

const handleClose = () => {
  emit('close');
};

const handleClear = () => {
  search.value = '';
  selectedBuckets.value = [];
  selectedPriorities.value = [];
  selectedTags.value = [];
  tagMode.value = 'any';
  dueDateStatus.value = 'all';
  dueAfter.value = '';
  dueBefore.value = '';
  hideDoneColumnLocal.value = false;
};

const handleApply = () => {
  let has_due_date: boolean | null = null;
  if (dueDateStatus.value === 'has') has_due_date = true;
  else if (dueDateStatus.value === 'none') has_due_date = false;

  const filters: TaskFilterParams = {
    search: search.value.trim() || undefined,
    buckets: selectedBuckets.value.length ? selectedBuckets.value.join(',') : undefined,
    priorities: selectedPriorities.value.length ? selectedPriorities.value.join(',') : undefined,
    tags: selectedTags.value.length ? selectedTags.value.join(',') : undefined,
    tag_mode: selectedTags.value.length ? tagMode.value : undefined,
    has_due_date,
    due_after: dueDateStatus.value !== 'none' && dueAfter.value ? dueAfter.value : undefined,
    due_before: dueDateStatus.value !== 'none' && dueBefore.value ? dueBefore.value : undefined,
  };

  settingsStore.hideDoneColumn = hideDoneColumnLocal.value;

  emit('apply', filters);
  emit('close');
};

// Setup native dialog cancel (Esc key) handler
const handleNativeClose = () => {
  emit('close');
};

// Light dismiss click fallback
const handleDialogClick = (event: MouseEvent) => {
  const dialog = dialogRef.value;
  if (!dialog) return;

  // Only handle light dismiss fallback if closedBy is not supported natively
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isDialogContent =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isDialogContent) {
      emit('close');
    }
  }
};
</script>

<template>
  <dialog
    ref="dialogRef"
    closedby="any"
    @close="handleNativeClose"
    @click="handleDialogClick"
    class="bg-theme-base border border-theme-border rounded-lg shadow-2xl p-0 max-w-3xl w-full max-h-[90vh] focus:outline-none overflow-hidden"
  >
    <!-- Header -->
    <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
      <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-1.5">
        <SlidersHorizontal class="w-4 h-4 shrink-0 text-theme-accent" />
        {{ t('filterModal.title') }}
      </h3>
      <button
        @click="handleClose"
        class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
      >
        <X class="w-4 h-4 shrink-0" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex-grow p-6 overflow-y-auto max-h-[70vh] scroller-thin">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Search Input (Full Width) -->
        <div class="md:col-span-2">
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
            {{ t('filterModal.searchLabel') }}
          </label>
          <input
            v-model="search"
            type="text"
            :placeholder="t('filterModal.searchPlaceholder')"
            class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input placeholder-theme-text-muted/40 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
          />
        </div>

        <!-- Columns/Buckets Filter (Full Width) -->
        <div v-if="buckets.length" class="md:col-span-2">
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
            {{ t('filterModal.columnsLabel') }}
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label
              v-for="b in buckets"
              :key="b.name"
              class="flex items-center gap-2 px-3 py-2 rounded border border-theme-border/50 bg-theme-card/30 hover:bg-theme-column/30 transition-all cursor-pointer text-xs text-theme-text-main animate-fade-in"
            >
              <input type="checkbox" :value="b.name" v-model="selectedBuckets" class="accent-theme-primary" />
              <span class="truncate" :title="b.title">{{ b.title }}</span>
            </label>
          </div>
        </div>

        <!-- Left Column: Priorities & Due Date Section -->
        <div class="space-y-6">
          <!-- Priorities Filter -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
              {{ t('filterModal.prioritiesLabel') }}
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label
                v-for="p in ['none', 'low', 'medium', 'high', 'urgent']"
                :key="p"
                class="flex items-center gap-2 px-2.5 py-1.5 rounded border border-theme-border/50 bg-theme-card/30 hover:bg-theme-column/30 transition-all cursor-pointer text-xs text-theme-text-main"
              >
                <input type="checkbox" :value="p" v-model="selectedPriorities" class="accent-theme-primary" />
                <span>{{ t(`priorityOptions.${p}`) }}</span>
              </label>
            </div>
          </div>

          <!-- Due Date Section -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
              {{ t('filterModal.dueDateLabel') }}
            </label>

            <div class="flex items-center gap-2 bg-theme-card border border-theme-border/50 rounded p-1 mb-3">
              <label
                v-for="status in ['all', 'has', 'none'] as const"
                :key="status"
                class="flex-1 text-center py-1 rounded text-xs font-semibold cursor-pointer transition-all select-none"
                :class="
                  dueDateStatus === status ? 'bg-theme-primary text-white font-bold' : 'text-theme-text-muted hover:text-theme-text-main'
                "
              >
                <input type="radio" :value="status" v-model="dueDateStatus" class="hidden" />
                {{ t(`filterModal.dueDate${status.charAt(0).toUpperCase() + status.slice(1)}`) }}
              </label>
            </div>

            <!-- Date ranges, only editable if not 'none' -->
            <div v-if="dueDateStatus !== 'none'" class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1 flex items-center gap-1">
                  <Calendar class="w-3 h-3 text-theme-text-muted" />
                  {{ t('filterModal.dueAfterLabel') }}
                </label>
                <input
                  v-model="dueAfter"
                  type="date"
                  class="w-full bg-theme-card border border-theme-border rounded px-2 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1 flex items-center gap-1">
                  <Calendar class="w-3 h-3 text-theme-text-muted" />
                  {{ t('filterModal.dueBeforeLabel') }}
                </label>
                <input
                  v-model="dueBefore"
                  type="date"
                  class="w-full bg-theme-card border border-theme-border rounded px-2 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Tags & Layout Options -->
        <div class="space-y-6">
          <!-- Tags Filter -->
          <div v-if="allTags.length">
            <div class="flex justify-between items-center mb-1.5">
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                {{ t('filterModal.tagsLabel') }}
              </label>

              <!-- Tag matching mode selection -->
              <div class="flex items-center gap-2 bg-theme-card border border-theme-border/50 rounded p-0.5 text-[10px]">
                <button
                  type="button"
                  @click="tagMode = 'any'"
                  class="px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer"
                  :class="tagMode === 'any' ? 'bg-theme-primary text-white font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
                >
                  {{ t('filterModal.tagModeAny') }}
                </button>
                <button
                  type="button"
                  @click="tagMode = 'all'"
                  class="px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer"
                  :class="tagMode === 'all' ? 'bg-theme-primary text-white font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
                >
                  {{ t('filterModal.tagModeAll') }}
                </button>
              </div>
            </div>

            <div
              class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto border border-theme-border/40 p-2 rounded bg-theme-card/25 scroller-thin animate-fade-in"
            >
              <label
                v-for="tag in allTags"
                :key="tag"
                class="flex items-center gap-1.5 px-2 py-1 rounded-full border border-theme-border/45 bg-theme-card/40 hover:bg-theme-column/45 cursor-pointer text-[11px] text-theme-text-main transition-all"
                :class="{ 'border-theme-primary/30 bg-theme-primary/10 text-theme-accent font-semibold': selectedTags.includes(tag) }"
              >
                <input type="checkbox" :value="tag" v-model="selectedTags" class="hidden" />
                <Tag class="w-2.5 h-2.5 shrink-0 text-theme-text-muted" />
                <span>{{ tag }}</span>
              </label>
            </div>
          </div>

          <!-- Layout Options -->
          <div class="border-t border-theme-border/30 pt-4">
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
              {{ t('settingsView.general') }}
            </label>
            <label
              class="flex items-center gap-2 px-3 py-2 rounded border border-theme-border/50 bg-theme-card/30 hover:bg-theme-column/30 transition-all cursor-pointer text-xs text-theme-text-main w-full"
            >
              <input id="hide-done-column-checkbox" type="checkbox" v-model="hideDoneColumnLocal" class="accent-theme-primary" />
              <span>{{ t('doneBucket.hide') }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Buttons -->
    <div class="p-3 border-t border-theme-border flex justify-between items-center bg-theme-card/30">
      <button
        type="button"
        @click="handleClear"
        class="flex items-center gap-1.5 px-3 py-1.5 border border-theme-border hover:bg-theme-column/30 text-theme-text-muted hover:text-theme-text-main rounded text-xs font-semibold transition-all cursor-pointer"
      >
        <Trash2 class="w-3.5 h-3.5" />
        {{ t('filterModal.clearAll') }}
      </button>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="handleClose"
          class="px-3.5 py-1.5 border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
        >
          {{ t('buttons.cancel') }}
        </button>
        <button
          type="button"
          @click="handleApply"
          class="px-4 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
        >
          {{ t('filterModal.apply') }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
dialog {
  display: none;
}
dialog[open] {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
}
dialog::backdrop {
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(2px);
}
</style>
