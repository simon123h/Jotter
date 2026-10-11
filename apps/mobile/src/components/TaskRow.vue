<script setup lang="ts">
import { computed } from 'vue';
import { CalendarDays, Check, Clock, ListChecks, Hourglass, Paperclip } from '@lucide/vue';
import type { Task } from '@jotter/vault-format';
import { t, type MessageKey } from '@/i18n';
import { dueInfo } from '@/dates';
import { checklistProgress } from '@/markdown';
import { plannedLabel } from '@/planned';
import { colorHex } from '@/taskColors';

const props = defineProps<{
  task: Task;
  /** Part of the selection (made by a long press). */
  selected?: boolean;
  /** Held down right now, before it is known whether it will be selected or dragged. */
  lifted?: boolean;
  /** A plain copy without gestures, for the card that floats under the finger while dragging. */
  inert?: boolean;
  /** Some task is selected: taps select instead of acting. */
  selecting?: boolean;
}>();
const emit = defineEmits<{
  (e: 'tap'): void;
  (e: 'done'): void;
  (e: 'reopen'): void;
}>();

// Done means finished for good. Archived is not done: the task is only off the board, so it stays open.
const done = computed(() => props.task.bucket === 'done');
const archived = computed(() => props.task.bucket === 'archive');

// Priority colours as in Todoist: the ring of the checkbox
const RING: Record<string, string> = { urgent: '#dc2626', high: '#f97316', medium: '#3b82f6', low: '#94a3b8' };
const ring = computed(() => RING[props.task.priority ?? ''] ?? 'var(--color-muted)');

const due = computed(() => (props.task.due_date ? dueInfo(props.task.due_date) : null));
const dueClass = { overdue: 'text-danger', today: 'text-emerald-600', tomorrow: 'text-amber-600', later: 'text-muted' } as const;
const bar = computed(() => colorHex(props.task.color));

/** The circle finishes the task, or takes a finished one back to the inbox. While tasks are selected it selects, like the row. */
function onCheck() {
  if (props.inert) return;
  if (props.selecting) emit('tap');
  else if (done.value) emit('reopen');
  else emit('done');
}

function onClick() {
  emit('tap');
}

const progress = computed(() => checklistProgress(props.task.body));

const hasMeta = computed(
  () =>
    due.value ||
    progress.value ||
    props.task.planned_date ||
    props.task.postponed_until ||
    props.task.tags.length ||
    props.task.attachments.length
);
</script>

<template>
  <div class="relative select-none overflow-hidden bg-card" data-testid="task-row">
    <div
      role="button"
      tabindex="0"
      class="relative flex cursor-pointer items-start gap-3 bg-card pl-4 row-pressable"
      :style="{
        backgroundColor: selected
          ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-card))'
          : lifted
            ? 'color-mix(in srgb, var(--color-accent) 7%, var(--color-card))'
            : undefined,
      }"
      data-testid="task-card"
      :data-selected="selected ? 'true' : undefined"
      :aria-pressed="!!selected"
      @click="onClick"
      @keydown.enter.self="emit('tap')"
    >
      <span v-if="bar" class="absolute inset-y-0 left-0 w-1" :style="{ backgroundColor: bar }" data-testid="row-color"></span>

      <!-- The circle finishes the task (or reopens it); the long press on the row is what selects -->
      <span
        class="-ml-1 -mr-1 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center"
        role="checkbox"
        :aria-checked="done"
        :aria-label="t(done ? 'swipe.reopen' : 'swipe.done')"
        data-testid="row-check"
        @click.stop="onCheck"
      >
        <span
          class="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors"
          :style="{
            borderColor: selected ? 'var(--color-accent)' : ring,
            backgroundColor: selected ? 'var(--color-accent)' : done ? ring : `color-mix(in srgb, ${ring} 12%, transparent)`,
          }"
        >
          <Check v-if="selected || done" class="h-3.5 w-3.5 text-accent-ink" :stroke-width="3" />
        </span>
      </span>

      <div class="min-w-0 flex-1 border-b border-line py-3 pr-4">
        <div
          class="break-words text-[16px] leading-snug"
          :class="done ? 'text-muted line-through' : archived ? 'text-muted' : ''"
          data-testid="row-title"
        >
          {{ task.title }}
        </div>
        <div v-if="hasMeta" class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          <span v-if="due" class="inline-flex items-center gap-1" :class="dueClass[due.tone]" data-testid="row-due">
            <CalendarDays class="h-3.5 w-3.5" />{{ due.text }}
          </span>
          <span v-if="task.planned_date" class="inline-flex items-center gap-1 text-accent" data-testid="card-planned">
            <Clock class="h-3.5 w-3.5" />{{ plannedLabel(task.planned_date) }}
          </span>
          <span v-if="task.postponed_until" class="inline-flex items-center gap-1 text-amber-600" data-testid="card-postponed">
            <Hourglass class="h-3.5 w-3.5" />{{ task.postponed_until }}
          </span>
          <span
            v-if="progress"
            class="inline-flex items-center gap-1"
            :class="progress.checked === progress.total ? 'text-emerald-600' : ''"
            data-testid="row-checklist"
          >
            <ListChecks class="h-3.5 w-3.5" />{{ progress.checked }}/{{ progress.total }}
          </span>
          <span v-if="task.attachments.length" class="inline-flex items-center gap-1">
            <Paperclip class="h-3.5 w-3.5" />{{ task.attachments.length }}
          </span>
          <span v-for="tag in task.tags" :key="tag">#{{ tag }}</span>
        </div>
        <span v-if="task.priority" class="sr-only">{{ t(`priority.${task.priority}` as MessageKey) }}</span>
      </div>
    </div>
  </div>
</template>
