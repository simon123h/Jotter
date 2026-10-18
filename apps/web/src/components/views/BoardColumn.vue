<script setup lang="ts">
import { computed } from 'vue';
import { Plus, MoreHorizontal, ChevronLeft } from '@lucide/vue';
import type { Task, Bucket, BucketName } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';

/** One column of the board: its header with the column's buttons, and its cards. */
const props = defineProps<{
  bucket: Bucket;
  tasks: Task[];
  projectId: string;
  isCollapsed: boolean;
  /** The column sits in the lower pane of the board, across its whole width. */
  isDocked: boolean;
}>();

const emit = defineEmits<{
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: any): void;
  (e: 'mark-done', task: Task): void;
  (e: 'toggle-select', task: Task): void;
  (e: 'toggle-collapse'): void;
  (e: 'edit', bucket: Bucket): void;
}>();

const { t, tBucket } = useI18n();
const settingsStore = useSettingsStore();

const isAll = computed(() => props.projectId === 'all');
const exceeded = computed(() => !!props.bucket.max_tasks && props.tasks.length > props.bucket.max_tasks);
</script>

<template>
  <GenericColumn
    :id="bucket.name"
    :title="tBucket(bucket.name, bucket.title)"
    :subtitle="bucket.subtitle"
    :tasks="tasks"
    :layout="isDocked ? 'auto' : bucket.layout"
    :color="bucket.color"
    :max-tasks="bucket.max_tasks"
    :is-limit-exceeded="exceeded"
    :show-add-task="!isAll"
    :is-read-only="isAll"
    :show-project="isAll"
    group-name="kanban-board"
    :is-collapsed="isCollapsed"
    :is-fluid="isDocked && !isCollapsed"
    :class="isDocked && !isCollapsed ? 'flex-1 min-w-0' : ''"
    @add-task-click="(id) => emit('add-task-click', id as BucketName)"
    @card-dropped="(payload) => emit('card-dropped', payload)"
    @mark-done="(task) => emit('mark-done', task)"
    @toggle-select="(task) => emit('toggle-select', task)"
    @toggle-collapse="emit('toggle-collapse')"
  >
    <template #header="{ classes }">
      <div
        class="px-3 py-2 flex justify-between items-center border-b rounded-t shrink-0 min-h-[48px]"
        :class="[classes.bg, classes.border, isAll ? '' : 'cursor-grab active:cursor-grabbing column-drag-handle']"
      >
        <div class="flex-grow flex flex-col justify-center overflow-hidden mr-1">
          <div class="flex items-center gap-1.5 overflow-hidden">
            <h3
              class="font-bold text-sm uppercase tracking-wider truncate max-w-[130px] md:max-w-[160px] cursor-pointer hover:text-theme-accent transition-colors"
              :class="[classes.text]"
              @dblclick="emit('edit', bucket)"
              :title="t('doubleClickToRename')"
            >
              {{ tBucket(bucket.name, bucket.title) }}
            </h3>
            <span
              class="text-xs px-1.5 py-0.25 font-bold rounded shrink-0 transition-all duration-300"
              :class="[exceeded ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400 animate-pulse' : classes.badge]"
            >
              {{ bucket.max_tasks ? `${tasks.length}/${bucket.max_tasks}` : tasks.length }}
            </span>
          </div>
          <span
            v-if="bucket.subtitle"
            class="text-xs text-theme-text-muted truncate cursor-pointer font-sans italic hover:text-theme-accent leading-normal"
            @dblclick="emit('edit', bucket)"
          >
            {{ bucket.subtitle }}
          </span>
        </div>
        <div class="flex items-center shrink-0 gap-1">
          <button
            v-if="!isDocked"
            @click.stop="emit('toggle-collapse')"
            class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer animate-fade-in"
            :title="t('collapseColumnTooltip')"
          >
            <ChevronLeft class="w-4 h-4 shrink-0" />
          </button>
          <button
            v-if="settingsStore.hideAddTaskButton && !isAll"
            @click="emit('add-task-click', bucket.name)"
            class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
          >
            <Plus class="w-4 h-4 shrink-0" />
          </button>
          <button
            v-if="!isAll"
            @click="emit('edit', bucket)"
            class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
            :title="t('renameColumnTooltip')"
          >
            <MoreHorizontal class="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </template>

    <!-- Custom Add Button -->
    <template #add-button>
      <button
        v-if="!settingsStore.hideAddTaskButton && !isAll"
        @click="emit('add-task-click', bucket.name)"
        class="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 mb-2.5 bg-theme-card/35 hover:bg-theme-accent/10 text-theme-text-muted hover:text-theme-accent border border-transparent rounded transition-all cursor-pointer group/btn shrink-0"
      >
        <Plus class="w-3.5 h-3.5 shrink-0 transition-transform group-hover/btn:scale-110" />
        <span class="text-sm font-semibold">{{ t('addTaskButton') }}</span>
      </button>
    </template>
  </GenericColumn>
</template>
