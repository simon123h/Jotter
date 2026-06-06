<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useTaskFilters } from '@/composables/useTaskFilters';
import TimelineLayout from '@/components/layout/TimelineLayout.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const { projects, tasks } = storeToRefs(projectStore);
const { hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

// Wait! Let's verify where useTaskSelection is defined. In ProjectLayout we did:
// import { useTaskSelection } from '@/composables/useTaskSelection';
// Let's import from '@/composables/useTaskSelection' to be sure!
import { useTaskSelection } from '@/composables/useTaskSelection';

const { isSelected, toggleSelection, clearSelection } = useTaskSelection();

const fetchAllTasks = async () => {
  // Fetch tasks for "super-time" mode (all projects)
  await projectStore.fetchTasks('', 'super-time', hideDoneColumn.value, hideArchiveColumn.value);
};

onMounted(async () => {
  document.title = `Jotter / ${t('views.globalTime') || 'Global Planning'}`;
  clearSelection();
  await fetchAllTasks();
});

watch([hideDoneColumn, hideArchiveColumn], () => {
  fetchAllTasks();
});

const { filteredTasks } = useTaskFilters(tasks);

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
        :tasks="filteredTasks"
        :projects="projects"
        group-name="global-time-view"
        :show-project-badge="true"
        :is-selected="isSelected"
        @toggle-select="toggleSelection($event.id)"
        @refresh="fetchAllTasks"
      />
    </div>
  </div>
</template>
