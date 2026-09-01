import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { BucketName, Project } from '@/types';

export type ModalType =
  'task-create' | 'project-edit' | 'filter' | 'import-spreadsheet' | 'move-tasks-confirm' | 'time-machine' | 'timeblock-edit' | null;

export const useModalStore = defineStore('modal', () => {
  const activeModal = ref<ModalType>(null);
  const modalProps = ref<Record<string, any>>({});

  const openModal = (type: ModalType, props: Record<string, any> = {}) => {
    activeModal.value = type;
    modalProps.value = props;
  };

  const closeModal = () => {
    activeModal.value = null;
    modalProps.value = {};
  };

  // Specific helpers for type safety
  const openTaskCreate = (defaultBucket: BucketName, overrides?: Record<string, any>) => {
    openModal('task-create', { defaultBucket, ...overrides });
  };

  const openProjectEdit = (project: Project) => {
    openModal('project-edit', { project });
  };

  const openFilter = () => {
    openModal('filter');
  };

  const openImportSpreadsheet = (projectId: string) => {
    openModal('import-spreadsheet', { projectId });
  };

  const openMoveTasksConfirm = (taskIds: string[], targetProjectId: string) => {
    openModal('move-tasks-confirm', { taskIds, targetProjectId });
  };

  const openTimeMachine = (projectId?: string) => {
    openModal('time-machine', { projectId });
  };

  const openTimeblockEdit = (timeblock?: any, initialDate?: string, initialStartTime?: string, initialEndTime?: string) => {
    openModal('timeblock-edit', { timeblock, initialDate, initialStartTime, initialEndTime });
  };

  return {
    activeModal,
    modalProps,
    openModal,
    closeModal,
    openTaskCreate,
    openProjectEdit,
    openFilter,
    openImportSpreadsheet,
    openMoveTasksConfirm,
    openTimeMachine,
    openTimeblockEdit,
  };
});
