<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  X,
  Trash2,
  Tag,
  Flag,
  Clock,
  ChevronRight,
  Plus,
  Check,
  Archive,
  SquareDashed,
  SquareKanban,
  FolderOpen,
  Calendar,
  Palette,
  Slash,
  Hourglass,
} from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket, Project } from '@/types';
import TagInput from '@/components/ui/TagInput.vue';

const { t, tBucket } = useI18n();

const props = defineProps<{
  selectedCount: number;
  buckets: Bucket[];
  projects: Project[];
  activeProjectId: string;
  commonTags: string[];
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
  (e: 'select-all'): void;
  (e: 'delete'): void;
  (e: 'archive'): void;
  (e: 'mark-done'): void;
  (e: 'move-bucket', bucket: string): void;
  (e: 'edit-tag', tag: string, forceRemove: boolean): void;
  (e: 'set-priority', priority: string): void;
  (e: 'set-planned', planned: string): void;
  (e: 'set-due-date', date: string): void;
  (e: 'move-project', projectId: string): void;
  (e: 'set-color', color: string | null): void;
  (e: 'set-postponed-date', date: string): void;
}>();

const colors = [
  { id: 'red', name: 'Red', bg: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'orange', name: 'Orange', bg: 'bg-amber-600', ring: 'ring-amber-600' },
  { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-500' },
  { id: 'green', name: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
  { id: 'pink', name: 'Pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
];

const activeMenu = ref<'none' | 'bucket' | 'tag' | 'priority' | 'planned' | 'project' | 'dueDate' | 'color' | 'postponedDate'>('none');

const toggleMenu = (menu: typeof activeMenu.value) => {
  activeMenu.value = activeMenu.value === menu ? 'none' : menu;
};

watch(
  () => props.selectedCount,
  (newCount) => {
    if (newCount === 0) {
      activeMenu.value = 'none';
    }
  }
);

const newTagName = ref('');
const handleAddTag = () => {
  if (newTagName.value.trim()) {
    const tagsToAdd = newTagName.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    for (const tag of tagsToAdd) {
      emit('edit-tag', tag, false);
    }
    newTagName.value = '';
  }
};

const customDueDate = ref('');

const setDueDatePreset = (preset: 'today' | 'tomorrow' | 'nextWeek' | 'clear') => {
  if (preset === 'clear') {
    emit('set-due-date', '');
  } else {
    const date = new Date();
    if (preset === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (preset === 'nextWeek') {
      date.setDate(date.getDate() + 7);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    emit('set-due-date', `${year}-${month}-${day}`);
  }
  // activeMenu.value = 'none';
};

const handleCustomDueDate = () => {
  emit('set-due-date', customDueDate.value);
  // activeMenu.value = 'none';
};

const customPostponedDate = ref('');

const setPostponedPreset = (preset: 'tomorrow' | 'nextWeek' | 'clear') => {
  if (preset === 'clear') {
    emit('set-postponed-date', '');
  } else {
    const date = new Date();
    if (preset === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (preset === 'nextWeek') {
      date.setDate(date.getDate() + 7);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    emit('set-postponed-date', `${year}-${month}-${day}`);
  }
  // activeMenu.value = 'none';
};

const handleCustomPostponedDate = () => {
  emit('set-postponed-date', customPostponedDate.value);
  // activeMenu.value = 'none';
};
</script>

<template>
  <transition name="slide-up">
    <div v-if="selectedCount > 0" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
      <!-- Nested Menus -->
      <div
        v-if="activeMenu !== 'none'"
        class="bg-theme-card border border-theme-border rounded-lg shadow-2xl p-1.5 min-w-[200px] mb-1 animate-in fade-in zoom-in duration-150"
      >
        <!-- Bucket Menu -->
        <div v-if="activeMenu === 'bucket'" class="flex flex-col">
          <button
            v-for="b in buckets"
            :key="b.name"
            @click="emit('move-bucket', b.name)"
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left cursor-pointer"
          >
            <div v-if="b.color" class="w-2 h-2 rounded-full" :style="{ backgroundColor: b.color }"></div>
            {{ tBucket(b.name, b.title) }}
          </button>
        </div>

        <!-- Tag Menu -->
        <div v-if="activeMenu === 'tag'" class="p-2 space-y-3">
          <!-- Common Tags Toggles -->
          <div v-if="commonTags.length" class="flex flex-wrap gap-1 max-w-[240px]">
            <div
              v-for="tag in commonTags"
              :key="tag"
              @click="emit('edit-tag', tag, false)"
              class="flex items-center gap-1.5 px-2 py-0.5 rounded border border-theme-border bg-theme-column/30 text-[10px] font-bold uppercase tracking-wider text-theme-text-muted cursor-pointer"
            >
              <span>{{ tag }}</span>
              <button
                @click="emit('edit-tag', tag, true)"
                type="button"
                class="flex items-center justify-center p-0.5 -mr-1 rounded-full hover:bg-theme-primary/20 hover:text-theme-accent transition-all cursor-pointer"
                aria-label="Remove tag"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full">
            <TagInput
              v-model="newTagName"
              @enter="handleAddTag"
              :placeholder="t('bulkActions.tagNamePlaceholder')"
              input-class="w-full bg-theme-base border border-theme-border rounded px-2 py-1 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
              placement="top"
            />
            <button
              @click="handleAddTag"
              class="p-1 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer shrink-0"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Priority Menu -->
        <div v-if="activeMenu === 'priority'" class="flex flex-col">
          <button
            v-for="p in ['none', 'low', 'medium', 'high', 'urgent']"
            :key="p"
            @click="emit('set-priority', p === 'none' ? '' : p)"
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left capitalize cursor-pointer"
          >
            <Flag
              class="w-3.5 h-3.5"
              :class="{
                'text-blue-400': p === 'low',
                'text-yellow-400': p === 'medium',
                'text-orange-400': p === 'high',
                'text-red-400': p === 'urgent',
                'text-theme-text-muted': p === 'none',
              }"
            />
            {{ p === 'none' ? t('priorityOptions.none') : t('priorityOptions.' + p) }}
          </button>
        </div>

        <!-- Planned Menu -->
        <div v-if="activeMenu === 'planned'" class="flex flex-col">
          <button
            v-for="p in ['', 'today', 'tomorrow', 'thisWeek', 'thisMonth', 'sometime']"
            :key="p"
            @click="emit('set-planned', p)"
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left cursor-pointer"
          >
            <Clock class="w-3.5 h-3.5 text-theme-text-muted" />
            {{ p === '' ? t('plannedDateOptions.none') : t('plannedDateOptions.' + p) }}
          </button>
        </div>

        <!-- Due Date Menu -->
        <div v-if="activeMenu === 'dueDate'" class="p-3 space-y-3 min-w-[240px]">
          <div class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1 text-left">
            {{ t('bulkActions.setDueDate') }}
          </div>
          <!-- Presets -->
          <div class="grid grid-cols-2 gap-1.5">
            <button
              @click="setDueDatePreset('today')"
              class="px-2 py-1.5 hover:bg-theme-column rounded text-xs text-theme-text-main hover:text-theme-accent transition-all text-center cursor-pointer border border-theme-border/30 bg-theme-base/30"
            >
              {{ t('bulkActions.dueDateToday') }}
            </button>
            <button
              @click="setDueDatePreset('tomorrow')"
              class="px-2 py-1.5 hover:bg-theme-column rounded text-xs text-theme-text-main hover:text-theme-accent transition-all text-center cursor-pointer border border-theme-border/30 bg-theme-base/30"
            >
              {{ t('bulkActions.dueDateTomorrow') }}
            </button>
            <button
              @click="setDueDatePreset('nextWeek')"
              class="px-2 py-1.5 hover:bg-theme-column rounded text-xs text-theme-text-main hover:text-theme-accent transition-all text-center cursor-pointer border border-theme-border/30 bg-theme-base/30"
            >
              {{ t('bulkActions.dueDateNextWeek') }}
            </button>
            <button
              @click="setDueDatePreset('clear')"
              class="px-2 py-1.5 hover:bg-rose-500/10 hover:text-rose-400 rounded text-xs text-theme-text-muted transition-all text-center cursor-pointer border border-theme-border/30 bg-theme-base/30"
            >
              {{ t('bulkActions.dueDateClear') }}
            </button>
          </div>

          <!-- Custom Date Picker -->
          <div class="space-y-1.5 pt-2 border-t border-theme-border/50 text-left">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
              {{ t('bulkActions.customDate') }}
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model="customDueDate"
                type="date"
                class="flex-grow bg-theme-base border border-theme-border rounded px-2 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              />
              <button
                @click="handleCustomDueDate"
                class="p-1.5 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer"
              >
                <Check class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Project Menu -->
        <div v-if="activeMenu === 'project'" class="flex flex-col max-h-64 overflow-y-auto scroller-thin">
          <button
            v-for="p in projects.filter((p) => p.id !== activeProjectId)"
            :key="p.id"
            @click="
              emit('move-project', p.id);
              activeMenu = 'none';
            "
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left cursor-pointer"
          >
            <ChevronRight class="w-3.5 h-3.5 text-theme-text-muted" />
            {{ p.title }}
          </button>
        </div>

        <!-- Color Menu -->
        <div v-if="activeMenu === 'color'" class="p-3 space-y-3 min-w-[200px]">
          <div class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1 text-left">
            {{ t('columnEdit.colorLabel') }}
          </div>
          <div class="flex flex-wrap gap-2.5 items-center">
            <!-- None / Clear Option -->
            <button
              type="button"
              @click="
                emit('set-color', null);
                activeMenu = 'none';
              "
              class="w-7 h-7 rounded-full border border-theme-border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 text-theme-text-muted hover:text-theme-text-main bg-theme-card/30 hover:bg-theme-card"
              :title="t('columnEdit.colorNone')"
            >
              <Slash class="w-3 h-3 shrink-0 rotate-90" />
            </button>

            <!-- Color Options -->
            <button
              v-for="c in colors"
              :key="c.id"
              type="button"
              @click="
                emit('set-color', c.id);
                activeMenu = 'none';
              "
              class="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95"
              :class="[c.bg]"
              :title="c.name"
            />
          </div>
        </div>

        <!-- Postponed Date Menu -->
        <div v-if="activeMenu === 'postponedDate'" class="p-3 space-y-3 min-w-[200px] text-left">
          <div class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
            {{ t('form.postponedUntilLabel') || 'Postponed Until' }}
          </div>
          <div class="flex flex-col gap-2">
            <button
              @click="setPostponedPreset('tomorrow')"
              class="w-full text-left px-2 py-1.5 hover:bg-theme-column rounded text-xs text-theme-text-main transition-colors font-semibold cursor-pointer"
            >
              {{ t('filterModal.postponedTomorrow') || 'Tomorrow' }}
            </button>
            <button
              @click="setPostponedPreset('nextWeek')"
              class="w-full text-left px-2 py-1.5 hover:bg-theme-column rounded text-xs text-theme-text-main transition-colors font-semibold cursor-pointer"
            >
              {{ t('filterModal.postponedNextWeek') || 'Next Week' }}
            </button>
            <button
              @click="setPostponedPreset('clear')"
              class="w-full text-left px-2 py-1.5 hover:bg-theme-column rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors font-semibold cursor-pointer"
            >
              {{ t('filterModal.postponedClear') || 'Clear Postponed' }}
            </button>
            <div class="border-t border-theme-border/40 my-1"></div>
            <div class="flex items-center gap-1.5">
              <input
                v-model="customPostponedDate"
                type="date"
                class="flex-grow bg-theme-base border border-theme-border rounded px-2 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              />
              <button
                @click="handleCustomPostponedDate"
                class="p-1.5 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer"
              >
                <Check class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Action Bar -->
      <div class="bg-theme-card border border-theme-border rounded-full shadow-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md">
        <div class="flex items-center gap-2.5 pr-4 border-r border-theme-border/50">
          <span class="w-6 h-6 flex items-center justify-center bg-theme-primary text-white rounded-full text-xs font-bold shadow-lg">
            {{ selectedCount }}
          </span>
          <span class="text-xs font-bold text-theme-text-main uppercase tracking-widest hidden sm:inline">
            {{ t('bulkActions.selected') }}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <button
            @click="emit('mark-done')"
            class="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.markDone')"
          >
            <Check class="w-4.5 h-4.5" />
          </button>

          <button
            @click="emit('archive')"
            class="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.archive')"
          >
            <Archive class="w-4.5 h-4.5" />
          </button>

          <div class="w-px h-6 bg-theme-border/50 mx-1"></div>

          <button
            @click="toggleMenu('bucket')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.moveToColumn')"
          >
            <SquareKanban class="w-4.5 h-4.5" />
          </button>

          <button
            @click="toggleMenu('tag')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.addTag')"
          >
            <Tag class="w-4.5 h-4.5" />
          </button>

          <button
            @click="toggleMenu('priority')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.setPriority')"
          >
            <Flag class="w-4.5 h-4.5" />
          </button>

          <button
            @click="toggleMenu('color')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('columnEdit.colorLabel') || 'Change Color'"
          >
            <Palette class="w-4.5 h-4.5" />
          </button>

          <button
            @click="toggleMenu('planned')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.planFor')"
          >
            <Clock class="w-4.5 h-4.5" />
          </button>

          <button
            @click="toggleMenu('dueDate')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.setDueDate')"
          >
            <Calendar class="w-4.5 h-4.5" />
          </button>

          <button
            @click="toggleMenu('postponedDate')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.postpone') || 'Postpone'"
          >
            <Hourglass class="w-4.5 h-4.5" />
          </button>

          <button
            @click="toggleMenu('project')"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.moveToProject')"
          >
            <FolderOpen class="w-4.5 h-4.5" />
          </button>

          <div class="w-px h-6 bg-theme-border/50 mx-1"></div>

          <button
            @click="emit('delete')"
            class="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.deleteSelected')"
          >
            <Trash2 class="w-4.5 h-4.5" />
          </button>
        </div>

        <div class="pl-2 border-l border-theme-border/50">
          <button
            @click="emit('select-all')"
            class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.selectAll')"
          >
            <SquareDashed class="w-4.5 h-4.5" />
          </button>
          <button
            @click="emit('clear')"
            class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.clearSelection')"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
  transform: translate(0%, 50%) scale(0.9);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translate(0%, 50%) scale(0.9);
  opacity: 0;
}
</style>
