<script setup lang="ts">
import { ref } from 'vue';
import { ClipboardList, Split } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Task } from '@/types';
import TaskChecklist from './TaskChecklist.vue';
import TaskAttachments from './TaskAttachments.vue';

defineProps<{
  task: Task;
  projectId: string;
  hasChecklist: boolean;
}>();

const emit = defineEmits<{
  (e: 'tag-click', tag: string): void;
  (e: 'update-body', body: string): void;
  (e: 'split-subtasks'): void;
  (e: 'add-checklist'): void;
  (e: 'update-task', updated: Task): void;
  (e: 'error', message: string): void;
  (e: 'preview-image', filename: string): void;
}>();

const { t } = useI18n();
const attachmentsRef = ref<InstanceType<typeof TaskAttachments> | null>(null);

const formatTimestamp = (isoString?: string | null): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString();
};

const getPriorityClasses = (prio: string) => {
  switch (prio) {
    case 'low':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25';
    case 'high':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/25';
    case 'urgent':
      return 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  }
};

defineExpose({
  /** Upload dropped files through the attachments section. */
  uploadFiles: (files: FileList) => attachmentsRef.value?.uploadFiles(files),
});
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-bold text-theme-text-main mb-1.5 leading-snug task-title select-text">
        {{ task.title }}
      </h2>

      <!-- Tags -->
      <div v-if="task.tags?.length" class="flex flex-wrap gap-1 mt-2">
        <span
          v-for="tag in task.tags"
          :key="tag"
          class="text-xs font-semibold px-2 py-0.5 bg-theme-card text-theme-text-card border border-theme-border rounded cursor-pointer transition-transform hover:scale-105"
          @click="emit('tag-click', tag)"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Due Date, Planned Date & Priority Info -->
      <div v-if="task.due_date || task.planned_date || task.priority" class="flex flex-wrap gap-3.5 mt-3 items-center">
        <div v-if="task.due_date" class="flex items-center gap-1.5 text-xs">
          <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('taskDetail.dueLabel') }}</span>
          <span class="bg-theme-card px-2 py-0.5 rounded border border-theme-border text-xs font-semibold text-theme-text-card">
            {{ new Date(task.due_date).toLocaleDateString() }}
          </span>
        </div>
        <div v-if="task.planned_date" class="flex items-center gap-1.5 text-xs">
          <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('taskDetail.plannedLabel') }}</span>
          <span class="bg-theme-card px-2 py-0.5 rounded border border-theme-border text-xs font-semibold text-theme-text-card">
            {{ t('plannedDateOptions.' + task.planned_date) }}
          </span>
        </div>
        <div v-if="task.postponed_until" class="flex items-center gap-1.5 text-xs">
          <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('taskDetail.postponedUntilLabel') }}</span>
          <span class="bg-theme-card px-2 py-0.5 rounded border border-theme-border text-xs font-semibold text-theme-text-card">
            {{ new Date(task.postponed_until).toLocaleDateString() }}
          </span>
        </div>
        <div v-if="task.priority" class="flex items-center gap-1.5 text-xs">
          <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('taskDetail.priorityLabel') }}</span>
          <span
            class="px-2 py-0.5 rounded border text-xs font-extrabold uppercase tracking-wider"
            :class="getPriorityClasses(task.priority)"
          >
            {{ t('priorityOptions.' + task.priority) }}
          </span>
        </div>
      </div>
    </div>

    <div class="border-t border-theme-border pt-4">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('notesLabel') }}</h4>
        <div class="flex items-center gap-2">
          <button
            v-if="hasChecklist"
            type="button"
            @click="emit('split-subtasks')"
            class="p-1 text-theme-text-muted hover:text-theme-accent hover:bg-theme-border/20 rounded transition-colors cursor-pointer opacity-70 hover:opacity-100"
            :title="t('form.splitSubtasksTooltip')"
            :aria-label="t('form.splitSubtasksTooltip')"
          >
            <Split class="w-3.5 h-3.5" />
          </button>
          <button
            v-if="!hasChecklist"
            type="button"
            @click="emit('add-checklist')"
            class="text-xs font-semibold px-2 py-1 bg-theme-column hover:bg-theme-column/80 text-theme-text-main border border-theme-border rounded flex items-center gap-1 transition-all cursor-pointer hover:border-theme-accent hover:text-theme-accent"
          >
            <ClipboardList class="w-3.5 h-3.5" />
            {{ t('form.quickAddChecklist') }}
          </button>
        </div>
      </div>

      <!-- Rendered Markdown with interactive checkboxes -->
      <TaskChecklist :body="task.body" @update:body="emit('update-body', $event)" @error="emit('error', $event)" />
    </div>

    <div
      v-if="task.created_at || task.updated_at"
      class="text-xs text-theme-text-muted flex gap-4 border-t border-theme-border pt-3 font-mono"
    >
      <span v-if="task.created_at">{{ t('timestampCreated', { date: formatTimestamp(task.created_at) }) }}</span>
      <span v-if="task.updated_at">{{ t('timestampUpdated', { date: formatTimestamp(task.updated_at) }) }}</span>
    </div>

    <!-- Attachments subcomponent -->
    <TaskAttachments
      ref="attachmentsRef"
      :project-id="projectId"
      :task-id="task.id"
      :attachments="task.attachments ?? []"
      @update-task="emit('update-task', $event)"
      @error="emit('error', $event)"
      @preview-image="emit('preview-image', $event)"
    />
  </div>
</template>
