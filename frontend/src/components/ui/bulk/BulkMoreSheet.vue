<script setup lang="ts">
import { computed, type Component } from 'vue';
import { Flag, Clock, FolderOpen, Calendar, Palette, Hourglass, Archive, ListCollapse, SquareDashed, MoreHorizontal, X } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { BulkMenu } from './types';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'menu', menu: Exclude<BulkMenu, 'none'>): void;
  (e: 'archive'): void;
  (e: 'consolidate'): void;
  (e: 'select-all'): void;
}>();

const { t } = useI18n();

type SheetAction = { key: string; icon: Component; iconClass: string; label: string; wide?: boolean } & (
  { menu: Exclude<BulkMenu, 'none'> } | { event: 'archive' | 'consolidate' | 'select-all' }
);

const actions = computed<SheetAction[]>(() => [
  { key: 'priority', menu: 'priority', icon: Flag, iconClass: 'text-amber-500', label: t('bulkActions.setPriority') },
  { key: 'color', menu: 'color', icon: Palette, iconClass: 'text-theme-accent', label: t('columnEdit.colorLabel') || 'Color' },
  { key: 'planned', menu: 'planned', icon: Clock, iconClass: 'text-sky-400', label: t('bulkActions.planFor') },
  { key: 'dueDate', menu: 'dueDate', icon: Calendar, iconClass: 'text-rose-400', label: t('bulkActions.setDueDate') },
  {
    key: 'postponedDate',
    menu: 'postponedDate',
    icon: Hourglass,
    iconClass: 'text-orange-400',
    label: t('bulkActions.postpone') || 'Postpone',
  },
  { key: 'project', menu: 'project', icon: FolderOpen, iconClass: 'text-emerald-400', label: t('bulkActions.moveToProject') },
  { key: 'archive', event: 'archive', icon: Archive, iconClass: 'text-indigo-400', label: t('bulkActions.archive') },
  { key: 'consolidate', event: 'consolidate', icon: ListCollapse, iconClass: 'text-teal-400', label: t('bulkActions.consolidate') },
  {
    key: 'select-all',
    event: 'select-all',
    icon: SquareDashed,
    iconClass: 'text-theme-text-muted',
    label: t('bulkActions.selectAll'),
    wide: true,
  },
]);

const run = (action: SheetAction) => {
  if ('menu' in action) emit('menu', action.menu);
  else emit(action.event);
};
</script>

<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="open" class="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-[130] transition-opacity" @click="emit('close')" />
    </transition>

    <transition name="sheet-slide">
      <div
        v-if="open"
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
            @click="emit('close')"
            class="p-1 rounded text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 transition-colors cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- More Actions Grid -->
        <div class="grid grid-cols-2 gap-2 overflow-y-auto py-1">
          <button
            v-for="action in actions"
            :key="action.key"
            @click="run(action)"
            class="flex items-center gap-2.5 p-2.5 rounded-xl border border-theme-border/60 bg-theme-column/20 hover:bg-theme-column/50 transition-colors text-left cursor-pointer"
            :class="{ 'col-span-2': action.wide }"
          >
            <component :is="action.icon" class="w-4 h-4 shrink-0" :class="action.iconClass" />
            <span class="text-xs font-semibold text-theme-text-main">{{ action.label }}</span>
          </button>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
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
