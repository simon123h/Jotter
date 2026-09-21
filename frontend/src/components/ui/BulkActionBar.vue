<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  X,
  Trash2,
  Tag,
  Flag,
  Clock,
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
  ListCollapse,
  MoreHorizontal,
} from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { usePomodoroStore } from '@/stores/pomodoro';
import type { Bucket, Project } from '@/types';
import TagInput from '@/components/ui/TagInput.vue';
import { sanitizeTags } from '@/utils/tagUtils';

const { t, tBucket } = useI18n();
const pomodoroStore = usePomodoroStore();
const isMoreSheetOpen = ref(false);

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
  (e: 'consolidate'): void;
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
      isMoreSheetOpen.value = false;
    }
  }
);

const newTagName = ref('');
const handleAddTag = () => {
  if (newTagName.value.trim()) {
    const tagsToAdd = sanitizeTags(newTagName.value);

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
    <div
      v-if="selectedCount > 0"
      class="fixed left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 select-none"
      :class="
        pomodoroStore.is_bar_open
          ? 'bottom-[calc(8.5rem+max(var(--sab),env(safe-area-inset-bottom,0px)))] md:bottom-22 bottom-20'
          : 'bottom-[calc(4.25rem+max(var(--sab),env(safe-area-inset-bottom,0px)))] md:bottom-6 bottom-6'
      "
    >
      <!-- Nested Menus -->
      <div
        v-if="activeMenu !== 'none'"
        class="bg-theme-card border border-theme-border rounded-lg shadow-2xl p-1.5 min-w-[200px] mb-1 animate-in fade-in zoom-in duration-150 max-h-[60vh] overflow-y-auto"
      >
        <!-- Bucket Menu -->
        <div v-if="activeMenu === 'bucket'" class="flex flex-col">
          <button
            v-for="b in buckets"
            :key="b.name"
            @click="
              emit('move-bucket', b.name);
              activeMenu = 'none';
            "
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
                :aria-label="t('buttons.removeTag')"
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
            @click="
              emit('set-priority', p === 'none' ? '' : p);
              activeMenu = 'none';
            "
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
            @click="
              emit('set-planned', p);
              activeMenu = 'none';
            "
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
              @click="
                setDueDatePreset('today');
                activeMenu = 'none';
              "
              class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer"
            >
              {{ t('bulkActions.dueDateToday') }}
            </button>
            <button
              @click="
                setDueDatePreset('tomorrow');
                activeMenu = 'none';
              "
              class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer"
            >
              {{ t('bulkActions.dueDateTomorrow') }}
            </button>
            <button
              @click="
                setDueDatePreset('nextWeek');
                activeMenu = 'none';
              "
              class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer"
            >
              {{ t('bulkActions.dueDateNextWeek') }}
            </button>
            <button
              @click="
                setDueDatePreset('clear');
                activeMenu = 'none';
              "
              class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer"
            >
              {{ t('bulkActions.dueDateClear') || 'Clear Due Date' }}
            </button>
          </div>

          <!-- Custom Date Picker -->
          <div class="space-y-1.5 pt-1 border-t border-theme-border/30">
            <label class="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider text-left">
              {{ t('bulkActions.customDate') }}
            </label>
            <div class="flex items-center gap-1.5">
              <input
                v-model="customDueDate"
                type="date"
                class="flex-grow px-2 py-1 text-xs bg-theme-bg border border-theme-border/60 rounded text-theme-text-main focus:outline-none focus:border-theme-primary"
              />
              <button
                @click="
                  handleCustomDueDate();
                  activeMenu = 'none';
                "
                class="p-1.5 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer"
              >
                <Check class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Project Menu -->
        <div v-if="activeMenu === 'project'" class="flex flex-col">
          <button
            v-for="p in projects"
            :key="p.id"
            @click="
              emit('move-project', p.id);
              activeMenu = 'none';
            "
            class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left cursor-pointer"
          >
            <FolderOpen class="w-3.5 h-3.5 text-theme-text-muted" />
            {{ p.title }}
          </button>
        </div>

        <!-- Color Menu -->
        <div v-if="activeMenu === 'color'" class="p-2">
          <div class="flex items-center gap-1.5">
            <button
              @click="
                emit('set-color', null);
                activeMenu = 'none';
              "
              class="w-6 h-6 rounded-full border border-theme-border bg-theme-card flex items-center justify-center text-theme-text-muted hover:text-theme-text-main cursor-pointer"
              :title="t('colors.default') || 'Default'"
            >
              <Slash class="w-3 h-3" />
            </button>
            <button
              v-for="c in colors"
              :key="c.id"
              @click="
                emit('set-color', c.id);
                activeMenu = 'none';
              "
              :class="[c.bg, 'w-6 h-6 rounded-full hover:scale-110 transition-transform cursor-pointer shadow-xs']"
              :title="c.name"
            ></button>
          </div>
        </div>

        <!-- Postponed Date Menu -->
        <div v-if="activeMenu === 'postponedDate'" class="p-3 space-y-3 min-w-[240px]">
          <div class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1 text-left">
            {{ t('bulkActions.postpone') || 'Postpone' }}
          </div>
          <!-- Presets -->
          <div class="grid grid-cols-2 gap-1.5">
            <button
              @click="
                setPostponedPreset('tomorrow');
                activeMenu = 'none';
              "
              class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer"
            >
              {{ t('dueDateOptions.postponedTomorrow') || 'Tomorrow' }}
            </button>
            <button
              @click="
                setPostponedPreset('nextWeek');
                activeMenu = 'none';
              "
              class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer"
            >
              {{ t('dueDateOptions.postponedNextWeek') || 'Next Week' }}
            </button>
            <button
              @click="
                setPostponedPreset('clear');
                activeMenu = 'none';
              "
              class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer col-span-2"
            >
              {{ t('dueDateOptions.postponedClear') || 'Clear Postponement' }}
            </button>
          </div>
          <!-- Custom Date Picker -->
          <div class="space-y-1.5 pt-1 border-t border-theme-border/30">
            <label class="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider text-left">
              {{ t('bulkActions.customDate') }}
            </label>
            <div class="flex items-center gap-1.5">
              <input
                v-model="customPostponedDate"
                type="date"
                class="flex-grow px-2 py-1 text-xs bg-theme-bg border border-theme-border/60 rounded text-theme-text-input focus:outline-none focus:border-theme-primary"
              />
              <button
                @click="
                  handleCustomPostponedDate();
                  activeMenu = 'none';
                "
                class="p-1.5 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer"
              >
                <Check class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Action Bar (Desktop + Mobile Compact) -->
      <div
        class="bg-theme-card/95 border border-theme-border rounded-full shadow-2xl px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-3 backdrop-blur-md"
      >
        <!-- Selection Counter Badge -->
        <div class="flex items-center gap-2 pr-2.5 sm:pr-3 border-r border-theme-border/50 shrink-0">
          <span class="w-6 h-6 flex items-center justify-center bg-theme-primary text-white rounded-full text-xs font-bold shadow-lg">
            {{ selectedCount }}
          </span>
          <span class="text-xs font-bold text-theme-text-main uppercase tracking-widest hidden lg:inline">
            {{ t('bulkActions.selected') }}
          </span>
        </div>

        <!-- Mobile Primary Actions (< md) -->
        <div class="flex md:hidden items-center gap-0.5 sm:gap-1">
          <button
            @click="emit('mark-done')"
            class="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.markDone')"
          >
            <Check class="w-4.5 h-4.5" />
          </button>
          <button
            @click="toggleMenu('bucket')"
            class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :class="activeMenu === 'bucket' ? 'bg-theme-primary/15 text-theme-primary' : ''"
            :title="t('bulkActions.moveToColumn')"
          >
            <SquareKanban class="w-4.5 h-4.5" />
          </button>
          <button
            @click="toggleMenu('tag')"
            class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :class="activeMenu === 'tag' ? 'bg-theme-primary/15 text-theme-primary' : ''"
            :title="t('bulkActions.addTag')"
          >
            <Tag class="w-4.5 h-4.5" />
          </button>
          <button
            @click="emit('delete')"
            class="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.deleteSelected')"
          >
            <Trash2 class="w-4.5 h-4.5" />
          </button>
          <button
            @click="isMoreSheetOpen = true"
            class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
            :class="isMoreSheetOpen ? 'bg-theme-primary/15 text-theme-primary' : ''"
            :title="t('bulkActions.moreActions')"
          >
            <MoreHorizontal class="w-4.5 h-4.5" />
          </button>
        </div>

        <!-- Desktop Full Toolbar (>= md) -->
        <div class="hidden md:flex items-center gap-1">
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

          <button
            @click="emit('consolidate')"
            class="p-2 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-full transition-all cursor-pointer"
            :title="t('bulkActions.consolidate')"
          >
            <ListCollapse class="w-4.5 h-4.5" />
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

        <div class="pl-1.5 sm:pl-2 border-l border-theme-border/50 flex items-center shrink-0">
          <button
            @click="emit('select-all')"
            class="hidden md:inline-flex p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
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

  <!-- MOBILE MORE ACTIONS BOTTOM SHEET -->
  <teleport to="body">
    <transition name="fade">
      <div
        v-if="isMoreSheetOpen && selectedCount > 0"
        class="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-[130] transition-opacity"
        @click="isMoreSheetOpen = false"
      />
    </transition>

    <transition name="sheet-slide">
      <div
        v-if="isMoreSheetOpen && selectedCount > 0"
        class="md:hidden fixed bottom-0 inset-x-0 bg-theme-card border-t border-theme-border rounded-t-2xl z-[135] p-4 pb-safe shadow-2xl max-h-[85vh] flex flex-col select-none"
      >
        <!-- Pull Handle -->
        <div class="w-10 h-1 bg-theme-border rounded-full mx-auto mb-3 shrink-0"></div>

        <!-- Header -->
        <div class="flex items-center justify-between pb-3 mb-2 border-b border-theme-border/60 shrink-0">
          <div class="flex items-center gap-2">
            <MoreHorizontal class="w-4 h-4 text-theme-accent" />
            <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">
              {{ t('bulkActions.moreActions') }}
            </h3>
          </div>
          <button
            @click="isMoreSheetOpen = false"
            class="p-1 rounded text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 transition-colors cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- More Actions Grid -->
        <div class="grid grid-cols-2 gap-2 overflow-y-auto py-1">
          <!-- Priority -->
          <button
            @click="
              isMoreSheetOpen = false;
              toggleMenu('priority');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <Flag class="w-4 h-4 text-amber-500 shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.setPriority') }}</span>
          </button>

          <!-- Color -->
          <button
            @click="
              isMoreSheetOpen = false;
              toggleMenu('color');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <Palette class="w-4 h-4 text-theme-accent shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('columnEdit.colorLabel') || 'Color' }}</span>
          </button>

          <!-- Plan For -->
          <button
            @click="
              isMoreSheetOpen = false;
              toggleMenu('planned');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <Clock class="w-4 h-4 text-sky-400 shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.planFor') }}</span>
          </button>

          <!-- Due Date -->
          <button
            @click="
              isMoreSheetOpen = false;
              toggleMenu('dueDate');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <Calendar class="w-4 h-4 text-rose-400 shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.setDueDate') }}</span>
          </button>

          <!-- Postpone -->
          <button
            @click="
              isMoreSheetOpen = false;
              toggleMenu('postponedDate');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <Hourglass class="w-4 h-4 text-orange-400 shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.postpone') || 'Postpone' }}</span>
          </button>

          <!-- Move to Project -->
          <button
            @click="
              isMoreSheetOpen = false;
              toggleMenu('project');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <FolderOpen class="w-4 h-4 text-emerald-400 shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.moveToProject') }}</span>
          </button>

          <!-- Archive -->
          <button
            @click="
              isMoreSheetOpen = false;
              emit('archive');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <Archive class="w-4 h-4 text-indigo-400 shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.archive') }}</span>
          </button>

          <!-- Consolidate -->
          <button
            @click="
              isMoreSheetOpen = false;
              emit('consolidate');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
          >
            <ListCollapse class="w-4 h-4 text-teal-400 shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.consolidate') }}</span>
          </button>

          <!-- Select All -->
          <button
            @click="
              isMoreSheetOpen = false;
              emit('select-all');
            "
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer col-span-2"
          >
            <SquareDashed class="w-4 h-4 text-theme-text-muted shrink-0" />
            <span class="text-xs font-semibold text-theme-text-main">{{ t('bulkActions.selectAll') }}</span>
          </button>
        </div>
      </div>
    </transition>
  </teleport>
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

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
