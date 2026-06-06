<script setup lang="ts">
import { onMounted } from 'vue';
import type { Task, Project } from '@/types';
import TimelineLayout from '@/components/layout/TimelineLayout.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
  projects: Project[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();

onMounted(() => {
  document.title = `Jotter / ${t('views.globalTime') || 'Global Planning'}`;
});
</script>

<template>
  <div class="flex flex-col h-full space-y-4">
    <div class="px-1">
      <h2 class="text-lg font-bold text-theme-text-main flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-theme-accent animate-pulse"></span>
        {{ t('views.globalTime') }}
        <span class="text-xs font-normal text-theme-text-muted ml-2 uppercase tracking-widest">{{ t('views.globalTimeDesc') }}</span>
      </h2>
    </div>

    <div class="flex-grow overflow-hidden">
      <TimelineLayout
        :tasks="props.tasks"
        :projects="props.projects"
        group-name="global-time-view"
        :show-project-badge="true"
        :is-selected="props.isSelected"
        @toggle-select="(task) => emit('toggle-select', task)"
        @refresh="emit('refresh')"
      />
    </div>
  </div>
</template>
