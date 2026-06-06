import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { BucketName, Project } from '@/types';

export type ModalType = 'task-create' | 'project-edit' | 'filter' | null;

interface ModalState {
  type: ModalType;
  props: Record<string, any>;
}

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

  return {
    activeModal,
    modalProps,
    openModal,
    closeModal,
    openTaskCreate,
    openProjectEdit,
    openFilter,
  };
});
