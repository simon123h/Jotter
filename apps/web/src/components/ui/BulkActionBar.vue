<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import {
  X,
  Trash2,
  Tag,
  Flag,
  Clock,
  Check,
  Archive,
  SquareDashed,
  SquareKanban,
  FolderOpen,
  Calendar,
  Palette,
  Hourglass,
  ListCollapse,
  MoreHorizontal,
} from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket, Project } from '@/types';
import BulkActionMenu from '@/components/ui/bulk/BulkActionMenu.vue';
import BulkMoreSheet from '@/components/ui/bulk/BulkMoreSheet.vue';
import type { BulkMenu } from '@/components/ui/bulk/types';

const { t } = useI18n();
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

const activeMenu = ref<BulkMenu>('none');
const menuRef = ref<InstanceType<typeof BulkActionMenu> | null>(null);

const toggleMenu = (menu: Exclude<BulkMenu, 'none'>) => {
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

const openTagMenu = () => {
  activeMenu.value = 'tag';
  nextTick(() => {
    menuRef.value?.focusTagInput();
  });
};

defineExpose({
  openTagMenu,
});
</script>

<template>
  <transition name="slide-up">
    <div
      v-if="selectedCount > 0"
      class="fixed left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 select-none bottom-[calc(4.25rem+max(var(--sab),env(safe-area-inset-bottom,0px)))] md:bottom-6 bottom-6"
    >
      <!-- Nested Menus -->
      <BulkActionMenu
        v-if="activeMenu !== 'none'"
        ref="menuRef"
        :menu="activeMenu"
        :buckets="buckets"
        :projects="projects"
        :common-tags="commonTags"
        @close="activeMenu = 'none'"
        @move-bucket="(bucket) => emit('move-bucket', bucket)"
        @edit-tag="(tag, forceRemove) => emit('edit-tag', tag, forceRemove)"
        @set-priority="(priority) => emit('set-priority', priority)"
        @set-planned="(planned) => emit('set-planned', planned)"
        @set-due-date="(date) => emit('set-due-date', date)"
        @move-project="(projectId) => emit('move-project', projectId)"
        @set-color="(color) => emit('set-color', color)"
        @set-postponed-date="(date) => emit('set-postponed-date', date)"
      />

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
  <BulkMoreSheet
    :open="isMoreSheetOpen && selectedCount > 0"
    @close="isMoreSheetOpen = false"
    @menu="
      (menu) => {
        isMoreSheetOpen = false;
        toggleMenu(menu);
      }
    "
    @archive="
      isMoreSheetOpen = false;
      emit('archive');
    "
    @consolidate="
      isMoreSheetOpen = false;
      emit('consolidate');
    "
    @select-all="
      isMoreSheetOpen = false;
      emit('select-all');
    "
  />
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
