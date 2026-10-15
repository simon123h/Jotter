import type { Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { getBuckets } from '@/api';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';

/**
 * Adds a task to the project chosen for quick capture, wherever the user is: opens that project, then the create
 * dialog in its default column. Does nothing when no project is chosen, when it is gone, or while a dialog is open.
 */
export function useCaptureTask(
  /** The project in view, '' outside a project. */
  currentProjectId: Ref<string>,
  openProject: (id: string) => unknown,
  openCreate: (bucket?: string) => void
) {
  const { captureProjectId } = storeToRefs(useSettingsStore());
  const { projects } = storeToRefs(useProjectStore());
  const modalStore = useModalStore();

  return async () => {
    const id = captureProjectId.value;
    if (!id || !projects.value.some((p) => p.id === id) || modalStore.activeModal) return;
    if (currentProjectId.value !== id) await openProject(id);
    const buckets = await getBuckets(id).catch(() => []);
    openCreate((buckets.find((b) => b.is_default) ?? buckets[0])?.name);
  };
}
