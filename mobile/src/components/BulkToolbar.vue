<script setup lang="ts">
import { Tag, Flag, FolderInput, EllipsisVertical, ListChecks } from '@lucide/vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

function selectAllHere() {
  const column = app.columns[ui.activeColumn];
  if (column) app.selectOnly(column.tasks.map((task) => task.id));
}

/** The bulk edits of a selection, in the order they sit in the toolbar. */
const actions = [
  { id: 'tag', icon: Tag, label: 'bulk.tag', sheet: 'bulk-tags' },
  { id: 'priority', icon: Flag, label: 'bulk.priority', sheet: 'bulk-priority' },
  { id: 'project', icon: FolderInput, label: 'bulk.project', sheet: 'bulk-project' },
  { id: 'more', icon: EllipsisVertical, label: 'bulk.more', sheet: 'bulk-more' },
] as const;

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
    <button :class="button" :aria-label="t('select.all')" data-testid="select-all" @click="selectAllHere">
      <ListChecks class="h-6 w-6" />
    </button>
    <button
      v-for="action in actions"
      :key="action.id"
      :class="button"
      :aria-label="t(action.label)"
      :data-testid="`bulk-${action.id}`"
      @click="ui.open({ type: action.sheet })"
    >
      <component :is="action.icon" class="h-6 w-6" />
    </button>
  </div>
</template>
