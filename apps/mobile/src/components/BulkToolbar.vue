<script setup lang="ts">
import { ArrowRightLeft, Tag, Flag, Clock, EllipsisVertical } from '@lucide/vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore, type Sheet } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

/** The bulk edits of a selection, in the order they sit in the toolbar. */
const actions: {
  id: string;
  icon: typeof Tag;
  label: 'bulk.move' | 'bulk.tag' | 'bulk.priority' | 'bulk.setPlanned' | 'bulk.more';
  sheet: () => Sheet;
}[] = [
  { id: 'move', icon: ArrowRightLeft, label: 'bulk.move', sheet: () => ({ type: 'move', ids: [...app.selection] }) },
  { id: 'tag', icon: Tag, label: 'bulk.tag', sheet: () => ({ type: 'bulk-tags' }) },
  { id: 'priority', icon: Flag, label: 'bulk.priority', sheet: () => ({ type: 'bulk-priority' }) },
  { id: 'planned', icon: Clock, label: 'bulk.setPlanned', sheet: () => ({ type: 'bulk-planned' }) },
  { id: 'more', icon: EllipsisVertical, label: 'bulk.more', sheet: () => ({ type: 'bulk-more' }) },
];

const button = 'flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-line';
</script>

<template>
  <!-- A floating toolbar: the actions for the selected tasks, within reach of the thumb -->
  <div
    class="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-card px-2 py-1 shadow-lg shadow-black/25"
    style="margin-bottom: env(safe-area-inset-bottom)"
    role="toolbar"
    data-testid="bulk-toolbar"
  >
    <button
      v-for="action in actions"
      :key="action.id"
      :class="button"
      :aria-label="t(action.label)"
      :data-testid="`bulk-${action.id}`"
      @click="ui.open(action.sheet())"
    >
      <component :is="action.icon" class="h-6 w-6" />
    </button>
  </div>
</template>
