<script setup lang="ts">
import { computed } from 'vue';
import { Paperclip, CalendarDays } from '@lucide/vue';
import type { Task } from '@jotter/vault-format';
import { t, type MessageKey } from '@/i18n';

const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ (e: 'open'): void }>();

const priorityClass: Record<string, string> = {
  low: 'bg-sky-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-600',
};

const overdue = computed(() => !!props.task.due_date && props.task.due_date < new Date().toISOString().slice(0, 10));
</script>

<template>
  <button
    class="block w-full rounded-xl border border-line bg-card p-3 text-left shadow-sm active:bg-line/50"
    :style="task.color ? { borderLeft: `4px solid ${task.color}` } : undefined"
    data-testid="task-card"
    @click="emit('open')"
  >
    <div class="flex items-start gap-2">
      <span
        v-if="task.priority && priorityClass[task.priority]"
        class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        :class="priorityClass[task.priority]"
        :title="t(`priority.${task.priority}` as MessageKey)"
      ></span>
      <span class="min-w-0 flex-1 break-words text-[15px] leading-snug">{{ task.title }}</span>
    </div>
    <div
      v-if="task.due_date || task.tags.length || task.attachments.length"
      class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
    >
      <span v-if="task.due_date" class="inline-flex items-center gap-1" :class="{ 'font-medium text-danger': overdue }">
        <CalendarDays class="h-3.5 w-3.5" />{{ task.due_date }}
      </span>
      <span v-if="task.attachments.length" class="inline-flex items-center gap-1"
        ><Paperclip class="h-3.5 w-3.5" />{{ task.attachments.length }}</span
      >
      <span v-for="tag in task.tags" :key="tag" class="rounded-full bg-line px-2 py-0.5">#{{ tag }}</span>
    </div>
  </button>
</template>
