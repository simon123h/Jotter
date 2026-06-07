<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useModalStore } from '@/stores/modal';
import { useProjectStore } from '@/stores/project';
import TaskCreateModal from './TaskCreateModal.vue';
import ProjectEditModal from './ProjectEditModal.vue';
import FilterModal from './FilterModal.vue';

const modalStore = useModalStore();
const projectStore = useProjectStore();

const { activeModal, modalProps } = storeToRefs(modalStore);

const handleTaskCreateSuccess = async () => {
  await projectStore.invalidate();
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
