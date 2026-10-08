<script setup lang="ts">
import { computed } from 'vue';
import { Paperclip, CalendarDays, Clock, Hourglass, Check, Archive } from '@lucide/vue';
import type { Task } from '@jotter/vault-format';
import { t, type MessageKey } from '@/i18n';
import { cardTint } from '@/taskColors';
import { plannedLabel } from '@/planned';

const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ (e: 'open'): void; (e: 'done'): void; (e: 'archive'): void }>();

// Done tasks offer to be archived, open ones to be finished; archived ones have nothing left to do
const quickAction = computed(() => (props.task.bucket === 'done' ? 'archive' : props.task.bucket === 'archive' ? null : 'done'));

const priorityClass: Record<string, string> = {
  low: 'bg-sky-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-600',
};

const overdue = computed(() => !!props.task.due_date && props.task.due_date < new Date().toISOString().slice(0, 10));
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="block w-full cursor-pointer select-none rounded-xl border border-line bg-card p-3 text-left shadow-sm active:bg-line/50"
    :style="cardTint(task.color)"
    data-testid="task-card"
    @click="emit('open')"
    @keydown.enter.self="emit('open')"
  >
    <div class="flex items-start gap-2">
      <span
        v-if="task.priority && priorityClass[task.priority]"
        class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        :class="priorityClass[task.priority]"
        :title="t(`priority.${task.priority}` as MessageKey)"
      ></span>
      <span class="min-w-0 flex-1 break-words text-[15px] leading-snug">{{ task.title }}</span>
      <!-- Stops the press here, so that it neither opens the card nor starts a drag -->
      <button
        v-if="quickAction"
        type="button"
        class="-m-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-line"
        :aria-label="quickAction === 'done' ? t('task.markDone') : t('task.archive')"
        :data-testid="quickAction === 'done' ? 'card-done' : 'card-archive'"
        @pointerdown.stop
        @click.stop="quickAction === 'done' ? emit('done') : emit('archive')"
      >
        <Check v-if="quickAction === 'done'" class="h-5 w-5" />
        <Archive v-else class="h-5 w-5" />
      </button>
    </div>
    <div
      v-if="task.due_date || task.planned_date || task.postponed_until || task.tags.length || task.attachments.length"
      class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
    >
      <span v-if="task.due_date" class="inline-flex items-center gap-1" :class="{ 'font-medium text-danger': overdue }">
        <CalendarDays class="h-3.5 w-3.5" />{{ task.due_date }}
      </span>
      <span v-if="task.planned_date" class="inline-flex items-center gap-1 text-accent" data-testid="card-planned">
        <Clock class="h-3.5 w-3.5" />{{ plannedLabel(task.planned_date) }}
      </span>
      <span v-if="task.postponed_until" class="inline-flex items-center gap-1 text-amber-600" data-testid="card-postponed">
        <Hourglass class="h-3.5 w-3.5" />{{ task.postponed_until }}
      </span>
      <span v-if="task.attachments.length" class="inline-flex items-center gap-1"
        ><Paperclip class="h-3.5 w-3.5" />{{ task.attachments.length }}</span
      >
      <span v-for="tag in task.tags" :key="tag" class="rounded-full bg-line px-2 py-0.5">#{{ tag }}</span>
    </div>
  </div>
</template>
