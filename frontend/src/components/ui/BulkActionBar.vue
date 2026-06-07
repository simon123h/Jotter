<script setup lang="ts">
import { ref } from 'vue';
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
} from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket, Project } from '@/types';

const { t } = useI18n();

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
}>();

const activeMenu = ref<'none' | 'bucket' | 'tag' | 'priority' | 'planned' | 'project' | 'dueDate'>('none');

const toggleMenu = (menu: typeof activeMenu.value) => {
  activeMenu.value = activeMenu.value === menu ? 'none' : menu;
};

const newTagName = ref('');
const handleAddTag = () => {
  if (newTagName.value.trim()) {
    emit('edit-tag', newTagName.value.trim(), false);
    newTagName.value = '';
    // activeMenu.value = 'none';
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
            {{ t('buckets.' + b.name) !== 'buckets.' + b.name ? t('buckets.' + b.name) : b.title }}
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

          <div class="flex items-center gap-2">
            <input
              v-model="newTagName"
              @keyup.enter="handleAddTag"
              type="text"
              :placeholder="t('bulkActions.tagNamePlaceholder')"
              class="flex-grow bg-theme-base border border-theme-border rounded px-2 py-1 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
            />
            <button @click="handleAddTag" class="p-1 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer">
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
