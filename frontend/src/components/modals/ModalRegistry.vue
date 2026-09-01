<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useModalStore } from '@/stores/modal';
import { useProjectStore } from '@/stores/project';
import TaskCreateModal from './TaskCreateModal.vue';
import ProjectEditModal from './ProjectEditModal.vue';
import FilterModal from './FilterModal.vue';
import TaskImportModal from './TaskImportModal.vue';
import MoveTasksConfirmModal from './MoveTasksConfirmModal.vue';
import TimeMachineModal from './TimeMachineModal.vue';
import TimeblockEditModal from './TimeblockEditModal.vue';

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
        :initial-priority="modalProps.priority"
        :initial-color="modalProps.color"
        :initial-planned="modalProps.planned"
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

      <!-- Task Import Modal -->
      <TaskImportModal
        v-else-if="activeModal === 'import-spreadsheet'"
        :is-open="true"
        :project-id="modalProps.projectId"
        @close="modalStore.closeModal"
        @success="handleTaskCreateSuccess"
      />

      <!-- Move Tasks Confirm Modal -->
      <MoveTasksConfirmModal
        v-else-if="activeModal === 'move-tasks-confirm'"
        :is-open="true"
        :task-ids="modalProps.taskIds"
        :target-project-id="modalProps.targetProjectId"
        @close="modalStore.closeModal"
      />

      <!-- Time Machine Modal -->
      <TimeMachineModal
        v-else-if="activeModal === 'time-machine'"
        :is-open="true"
        :project-id="modalProps.projectId"
        @close="modalStore.closeModal"
      />

      <!-- Timeblock Edit Modal -->
      <TimeblockEditModal
        v-else-if="activeModal === 'timeblock-edit'"
        :is-open="true"
        :timeblock="modalProps.timeblock"
        :initial-date="modalProps.initialDate"
        :initial-start-time="modalProps.initialStartTime"
        :initial-end-time="modalProps.initialEndTime"
        @close="modalStore.closeModal"
      />
    </div>
  </Transition>
</template>
