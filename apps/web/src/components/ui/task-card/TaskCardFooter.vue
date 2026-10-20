<script setup lang="ts">
import { computed } from 'vue';
import { Calendar, Clock, Paperclip, Box, Repeat, Bell, Link } from '@lucide/vue';
import { domainOf, taskUrl } from '@jotter/links';
import { repeatLabel } from '@/utils/repeat';
import { plannedLabel } from '@/utils/planned';
import type { Task, Timeblock } from '@/types';
import type { ChecklistStats } from '@/utils/checklist';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';
import { getTagClasses } from '@/utils/tagStyles';
import ChecklistProgress from './ChecklistProgress.vue';

const props = defineProps<{
  task: Task;
  compact: boolean;
  showTags: boolean;
  checklistStats: ChecklistStats | null;
  /** Show the checklist progress here (it is hidden when the checklist itself is rendered above). */
  showChecklistStats: boolean;
  allocatedTimeblock?: Timeblock;
}>();

const emit = defineEmits<{
  (e: 'tag-click', tag: string): void;
}>();

const { t, locale } = useI18n();
const settingsStore = useSettingsStore();

/** The address in the title or the notes: the task is a bookmark, and the card links to it. */
const url = computed(() => taskUrl(props.task));
const domain = computed(() => (url.value ? domainOf(url.value) : null));

const hasContent = computed(
  () =>
    !!(
      domain.value ||
      props.task.due_date ||
      props.task.planned_date ||
      props.task.priority ||
      props.task.repeat ||
      (props.task.reminders && props.task.reminders.length) ||
      (props.task.attachments && props.task.attachments.length) ||
      (props.showTags && props.task.tags && props.task.tags.length) ||
      (props.checklistStats && props.showChecklistStats)
    )
);

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getPriorityClasses = (prio: string) => {
  switch (prio) {
    case 'low':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'high':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'urgent':
      return 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
};
</script>

<template>
  <div v-if="hasContent" class="flex flex-wrap items-center gap-2 text-xs text-theme-text-muted select-none mt-1">
    <!-- Tags -->
    <div v-if="showTags && task.tags && task.tags.length" class="flex flex-wrap gap-1">
      <span
        v-for="tag in task.tags"
        :key="tag"
        class="rounded border uppercase tracking-wider leading-none cursor-pointer transition-transform"
        :class="[
          getTagClasses(tag, settingsStore.tagColors),
          compact ? 'text-[8px] px-1 py-0.25 font-bold' : 'text-[10px] px-1.5 py-0.25 font-extrabold',
        ]"
        @click.stop.prevent="emit('tag-click', tag)"
      >
        {{ tag }}
      </span>
    </div>

    <!-- Link: the domain of the first address in the title or the notes -->
    <a
      v-if="url && domain"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="flex min-w-0 items-center gap-1 text-theme-accent/80 hover:text-theme-accent hover:underline"
      :title="url"
      data-testid="card-link"
      @click.stop
    >
      <Link :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
      <span class="max-w-[10rem] truncate" :class="{ 'text-[10px]': compact }">{{ domain }}</span>
    </a>

    <!-- Due Date -->
    <div v-if="task.due_date" class="flex items-center gap-1 text-theme-text-muted" :title="'Due: ' + formatDate(task.due_date)">
      <Calendar :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
      <span :class="{ 'text-[10px]': compact }">{{ formatDate(task.due_date) }}</span>
    </div>

    <!-- Planned date -->
    <div
      v-if="task.planned_date"
      class="flex items-center gap-1 text-theme-accent/80"
      :title="'Planned: ' + plannedLabel(task.planned_date, t, locale)"
    >
      <Clock class="w-3 h-3" />
      <span :class="{ 'text-[10px]': compact }">{{ plannedLabel(task.planned_date, t, locale) }}</span>
    </div>

    <!-- Repeat rule and reminders -->
    <div
      v-if="task.repeat"
      class="flex items-center gap-1 text-theme-text-muted"
      :title="repeatLabel(task.repeat, t)"
      data-testid="card-repeat"
    >
      <Repeat :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
      <span :class="{ 'text-[10px]': compact }">{{ repeatLabel(task.repeat, t) }}</span>
    </div>
    <div v-if="task.reminders && task.reminders.length" class="flex items-center gap-1 text-theme-text-muted" data-testid="card-reminders">
      <Bell :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
      <span v-if="task.reminders.length > 1" :class="{ 'text-[10px]': compact }">{{ task.reminders.length }}</span>
    </div>

    <!-- Attachments -->
    <div
      v-if="task.attachments && task.attachments.length"
      class="flex items-center gap-1 text-theme-text-muted hover:text-theme-text-main transition-colors"
      :title="t('form.attachmentsCount', { count: task.attachments.length })"
    >
      <Paperclip :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0 text-theme-text-muted/80" />
      <span v-if="task.attachments.length > 1" :class="{ 'text-[10px]': compact }">{{ task.attachments.length }}</span>
    </div>

    <!-- Priority -->
    <div
      v-if="task.priority"
      class="rounded border uppercase tracking-wider leading-none"
      :class="[
        getPriorityClasses(task.priority),
        compact ? 'text-[8px] px-1 py-0.25 font-bold' : 'text-[10px] px-1.5 py-0.25 font-extrabold',
      ]"
    >
      {{ task.priority }}
    </div>

    <!-- Timeblock Allocation Badge -->
    <div
      v-if="allocatedTimeblock"
      class="inline-flex items-center gap-1 px-1.5 py-0.25 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
      :title="`${allocatedTimeblock.date} ${allocatedTimeblock.start_time}-${allocatedTimeblock.end_time}: ${allocatedTimeblock.title}`"
    >
      <Box :class="compact ? 'w-2.5 h-2.5' : 'w-3 h-3'" class="text-indigo-400 shrink-0" />
      <span class="truncate max-w-[100px]">{{ allocatedTimeblock.title }}</span>
    </div>

    <!-- Checklist progress (only here when the checklist itself isn't rendered above) -->
    <ChecklistProgress v-if="checklistStats && showChecklistStats" :stats="checklistStats" :compact="compact" class="ml-auto" />
  </div>
</template>
