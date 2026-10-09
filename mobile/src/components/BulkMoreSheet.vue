<script setup lang="ts">
import { ref } from 'vue';
import { ArrowRightLeft, Archive, CalendarDays, Check, Palette, Slash, Trash2 } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';
import { TASK_COLORS } from '@/taskColors';

const app = useAppStore();
const ui = useUiStore();
const actions = useTaskActions();

type Section = 'due' | 'color';
const open = ref<Section | null>(null);
const due = ref('');
const row = 'flex h-14 w-full items-center gap-4 px-6 text-left text-base active:bg-line';
const field = 'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent';

const ids = () => [...app.selection];
const toggle = (section: Section) => (open.value = open.value === section ? null : section);

async function finish(run: () => Promise<void>) {
  ui.close();
  await run();
}

async function remove() {
  if (!window.confirm(t('bulk.confirmDelete', { count: app.selectedCount }))) return;
  await finish(() => actions.remove(ids()));
}
</script>

<template>
  <BottomSheet :title="`${t('bulk.more')} · ${app.selectedCount}`" @close="ui.close()">
    <div class="-mx-4 pb-2" data-testid="bulk-more">
      <button :class="row" data-testid="more-done" @click="finish(() => actions.markDone(ids()))">
        <Check class="h-5 w-5 shrink-0 text-muted" />{{ t('task.markDone') }}
      </button>
      <!-- The board moves tasks by swipe; the other views have no columns to swipe between -->
      <button v-if="app.view !== 'board'" :class="row" data-testid="more-move" @click="ui.open({ type: 'move', ids: ids() })">
        <ArrowRightLeft class="h-5 w-5 shrink-0 text-muted" />{{ t('move.title') }}
      </button>
      <button :class="row" data-testid="more-archive" @click="finish(() => actions.archive(ids()))">
        <Archive class="h-5 w-5 shrink-0 text-muted" />{{ t('task.archive') }}
      </button>

      <button :class="row" data-testid="more-due" @click="toggle('due')">
        <CalendarDays class="h-5 w-5 shrink-0 text-muted" />{{ t('bulk.setDue') }}
      </button>
      <div v-if="open === 'due'" class="flex gap-2 px-6 pb-3">
        <input v-model="due" type="date" :class="field" data-testid="more-due-input" />
        <button
          class="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
          :disabled="!due"
          data-testid="more-due-apply"
          @click="finish(() => actions.setDue(ids(), due))"
        >
          {{ t('bulk.apply') }}
        </button>
        <button
          class="rounded-xl border border-line px-3 text-sm"
          data-testid="more-due-clear"
          @click="finish(() => actions.setDue(ids(), ''))"
        >
          {{ t('bulk.clearDate') }}
        </button>
      </div>

      <button :class="row" data-testid="more-color" @click="toggle('color')">
        <Palette class="h-5 w-5 shrink-0 text-muted" />{{ t('bulk.setColor') }}
      </button>
      <div v-if="open === 'color'" class="flex flex-wrap items-center gap-2.5 px-6 pb-3">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted"
          :aria-label="t('color.none')"
          data-testid="more-color-none"
          @click="finish(() => actions.setColor(ids(), ''))"
        >
          <Slash class="h-4 w-4 rotate-90" />
        </button>
        <button
          v-for="c in TASK_COLORS"
          :key="c.id"
          class="h-8 w-8 rounded-full"
          :style="{ backgroundColor: c.hex }"
          :aria-label="t(`color.${c.id}` as MessageKey)"
          :data-testid="`more-color-${c.id}`"
          @click="finish(() => actions.setColor(ids(), c.id))"
        ></button>
      </div>

      <button :class="`${row} text-danger`" data-testid="more-delete" @click="remove">
        <Trash2 class="h-5 w-5 shrink-0" />{{ t('bulk.delete') }}
      </button>
    </div>
  </BottomSheet>
</template>
