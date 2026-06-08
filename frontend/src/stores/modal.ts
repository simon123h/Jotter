import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { BucketName, Project } from '@/types';

export type ModalType = 'task-create' | 'project-edit' | 'filter' | 'import-planner' | 'move-tasks-confirm' | null;

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
  const openTaskCreate = (defaultBucket: BucketName) => {
    openModal('task-create', { defaultBucket });
  };

  const openProjectEdit = (project: Project) => {
    openModal('project-edit', { project });
  };

  const openFilter = () => {
    openModal('filter');
  };

  const openImportPlanner = (projectId: string) => {
    openModal('import-planner', { projectId });
  };

  const openMoveTasksConfirm = (taskIds: string[], targetProjectId: string) => {
    openModal('move-tasks-confirm', { taskIds, targetProjectId });
  };

  return {
    activeModal,
    modalProps,
    openModal,
    closeModal,
    openTaskCreate,
    openProjectEdit,
    openFilter,
    openImportPlanner,
    openMoveTasksConfirm,
  };
});
