<script setup lang="ts">
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useModalStore } from '@/stores/modal';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import TaskCreateModal from './TaskCreateModal.vue';
import ProjectEditModal from './ProjectEditModal.vue';
import FilterModal from './FilterModal.vue';

const route = useRoute();
const modalStore = useModalStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const { activeModal, modalProps } = storeToRefs(modalStore);

const handleTaskCreateSuccess = () => {
  const isGlobalTime = route.name?.toString().startsWith('global-time');
  const projectId = (route.params.projectId as string) || settingsStore.activeProjectId;
  
  if (isGlobalTime) {
    projectStore.fetchTasks('', 'super-time', settingsStore.hideDoneColumn, settingsStore.hideArchiveColumn);
  } else if (projectId) {
    projectStore.fetchTasks(projectId, '', settingsStore.hideDoneColumn, settingsStore.hideArchiveColumn);
  }
};
</script>

<template>
  <Transition name="modal">
    <div v-if="activeModal">
      <!-- Task Create Modal -->
      <TaskCreateModal
        v-if="activeModal === 'task-create'"
        :is-open="true"
        :default-bucket="modalProps.defaultBucket"
        @close="modalStore.closeModal"
        @success="handleTaskCreateSuccess"
      />

      <!-- Project Edit Modal -->
      <ProjectEditModal
        v-else-if="activeModal === 'project-edit'"
        :is-open="true"
        :project="modalProps.project"
        @close="modalStore.closeModal"
      />

      <!-- Filter Modal -->
      <FilterModal
        v-else-if="activeModal === 'filter'"
        :is-open="true"
        :current-filters="modalProps.currentFilters"
        @close="modalStore.closeModal"
        @apply="modalProps.onApply"
      />
    </div>
  </Transition>
</template>
