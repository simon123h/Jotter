<script setup lang="ts">
import { computed } from 'vue';
import { Archive, ArrowRightLeft, CalendarDays, Check, Clock, Hourglass, Paperclip } from '@lucide/vue';
import type { Task } from '@jotter/vault-format';
import { t, type MessageKey } from '@/i18n';
import { dueInfo } from '@/dates';
import { plannedLabel } from '@/planned';
import { colorHex } from '@/taskColors';
import { useRowSwipe, type SwipeDirection } from '@/composables/useRowSwipe';

const props = defineProps<{
  task: Task;
  /** A plain copy without gestures, for the card that floats under the finger while dragging. */
  inert?: boolean;
}>();
const emit = defineEmits<{
  (e: 'open'): void;
  (e: 'done'): void;
  (e: 'archive'): void;
  (e: 'reopen'): void;
  (e: 'move'): void;
}>();

const finished = computed(() => props.task.bucket === 'done' || props.task.bucket === 'archive');

/** What a swipe to the right does: finish an open task, archive a done one, nothing for an archived one. */
const rightAction = computed<'done' | 'archive' | null>(() =>
  props.task.bucket === 'archive' ? null : props.task.bucket === 'done' ? 'archive' : 'done'
);

const swipe = useRowSwipe({
  allowed: (direction: SwipeDirection) => (direction === 'right' ? rightAction.value !== null : true),
  exits: (direction: SwipeDirection) => direction === 'right',
  onTrigger: (direction: SwipeDirection) => {
    if (direction === 'left') emit('move');
    else if (rightAction.value === 'done') emit('done');
    else if (rightAction.value === 'archive') emit('archive');
  },
  disabled: () => !!props.inert,
});

// Priority colours as in Todoist: the ring of the checkbox
const RING: Record<string, string> = { urgent: '#dc2626', high: '#f97316', medium: '#3b82f6', low: '#94a3b8' };
const ring = computed(() => RING[props.task.priority ?? ''] ?? 'var(--color-muted)');

const due = computed(() => (props.task.due_date ? dueInfo(props.task.due_date) : null));
const dueClass = { overdue: 'text-danger', today: 'text-emerald-600', tomorrow: 'text-amber-600', later: 'text-muted' } as const;
const bar = computed(() => colorHex(props.task.color));

// A swipe that starts on the checkbox is a swipe, not a tap on it
function onCheck() {
  if (swipe.consumeClick()) return;
  if (finished.value) emit('reopen');
  else emit('done');
}

function onClick() {
  if (!swipe.consumeClick()) emit('open');
}

const hasMeta = computed(
  () => due.value || props.task.planned_date || props.task.postponed_until || props.task.tags.length || props.task.attachments.length
);
</script>

<template>
  <div class="relative select-none overflow-hidden bg-card" data-testid="task-row">
    <!-- What the swipe will do, behind the row -->
    <div
      v-if="swipe.dx.value > 0 && rightAction"
      class="absolute inset-0 flex items-center gap-2 pl-5 text-sm font-semibold text-white"
      :class="rightAction === 'done' ? 'bg-emerald-500' : 'bg-indigo-500'"
      data-testid="swipe-right-bg"
    >
      <Check v-if="rightAction === 'done'" class="h-6 w-6" />
      <Archive v-else class="h-6 w-6" />
      <span :class="swipe.armed.value ? 'opacity-100' : 'opacity-70'">{{
        t(rightAction === 'done' ? 'swipe.done' : 'swipe.archive')
      }}</span>
    </div>
    <div
      v-if="swipe.dx.value < 0"
      class="absolute inset-0 flex items-center justify-end gap-2 bg-accent pr-5 text-sm font-semibold text-accent-ink"
      data-testid="swipe-left-bg"
    >
      <span :class="swipe.armed.value ? 'opacity-100' : 'opacity-70'">{{ t('swipe.move') }}</span>
      <ArrowRightLeft class="h-6 w-6" />
    </div>

    <div
      role="button"
      tabindex="0"
      class="relative flex cursor-pointer touch-pan-y items-start gap-3 bg-card pl-4 active:bg-line/40"
      :style="{
        transform: swipe.dx.value ? `translate3d(${swipe.dx.value}px, 0, 0)` : undefined,
        transition: swipe.settling.value ? 'transform 0.16s ease-out' : undefined,
      }"
      data-testid="task-card"
      @pointerdown="swipe.onPointerDown"
      @click="onClick"
      @keydown.enter.self="emit('open')"
    >
      <span v-if="bar" class="absolute inset-y-0 left-0 w-1" :style="{ backgroundColor: bar }" data-testid="row-color"></span>

      <!-- The checkbox: finishes an open task, reopens a finished one -->
      <button
        type="button"
        class="-ml-1 -mr-1 mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center"
        :aria-label="finished ? t('task.reopen') : t('task.markDone')"
        :aria-pressed="finished"
        data-testid="row-check"
        @click.stop="onCheck"
      >
        <span
          class="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors"
          :style="{ borderColor: ring, backgroundColor: finished ? ring : `color-mix(in srgb, ${ring} 12%, transparent)` }"
        >
          <Check v-if="finished" class="h-3.5 w-3.5 text-white" :stroke-width="3" />
        </span>
      </button>

      <div class="min-w-0 flex-1 border-b border-line py-3 pr-4">
        <div class="break-words text-[16px] leading-snug" :class="finished ? 'text-muted line-through' : ''" data-testid="row-title">
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
