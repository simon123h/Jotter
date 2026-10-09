<script setup lang="ts">
import { ref, watch, computed, onUnmounted, nextTick, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { storeToRefs } from 'pinia';
import type { Task } from '@/types';
import { getTask, getAttachmentUrl } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useFileDrop } from '@/composables/useFileDrop';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { useProjectStore } from '@/stores/project';
import { X } from '@lucide/vue';
import { parseTitleState } from '@jotter/title-parser';

// Modular sub-components and composables
import { useTaskEditor, provideTaskEditor } from '@/features/task-editor/composables/useTaskEditor';
import { useTaskDetailActions } from '@/features/task-editor/composables/useTaskDetailActions';
import TaskDetailView from '@/features/task-editor/components/TaskDetailView.vue';
import TaskDetailFooter from '@/features/task-editor/components/TaskDetailFooter.vue';
import TaskEditFields from '@/features/task-editor/components/TaskEditFields.vue';
import TaskImageLightbox from '@/features/task-editor/components/TaskImageLightbox.vue';
import BaseModal from '@/components/ui/BaseModal.vue';

const { locale, t } = useI18n();
const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const { buckets, tasks } = storeToRefs(projectStore);

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const projectId = computed(() => String(route.params.projectId));
const taskId = computed(() => (route.params.taskId ? String(route.params.taskId) : null));

const actualProjectId = computed(() => {
  if (projectId.value !== 'all') {
    return projectId.value;
  }
  if (task.value) {
    return task.value.project_id;
  }
  const found = tasks.value.find((t) => String(t.id) === taskId.value);
  if (found) {
    return found.project_id;
  }
  return '';
});

const task = ref<Task | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const editFieldsRef = ref<any>(null);
const detailViewRef = ref<InstanceType<typeof TaskDetailView> | null>(null);

const { patchTask } = useTaskMutations(
  tasks,
  actualProjectId,
  async () => {
    await projectStore.fetchBuckets(actualProjectId.value);
  },
  async () => {
    emit('refresh');
  }
);

// Modular local edit state orchestration
const taskEditor = useTaskEditor({
  task,
  buckets,
  locale,
  patchTask,
  titleInput: computed(() => editFieldsRef.value?.titleInputRef),
});
provideTaskEditor(taskEditor);

const {
  isEditing,
  form: editForm,
  initEditState,
  cancelEdit,
  handleSave: editorHandleSave,
  addChecklistItem: editorAddChecklistItem,
  hasChecklist,
} = taskEditor;

// Full-screen Image preview lightbox state
const previewImageUrl = ref<string | null>(null);
const previewImageName = ref<string>('');

const handleKeyDown = (event: KeyboardEvent) => {
  if (previewImageUrl.value) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      event.stopPropagation();
      previewImageUrl.value = null;
      return;
    }
  }

  if (event.key === 'Escape' || event.key === 'Esc') {
    closeModal();
  } else if (event.ctrlKey && event.key === 'Enter') {
    if (isEditing.value) {
      event.preventDefault();
      handleSave();
    }
  }
};

const closeModal = () => {
  const backRouteName = (route.meta.backRoute as string) || 'board';
  router.push({
    name: backRouteName,
    params: { projectId: projectId.value },
    query: route.query,
  });
};

const handleTagClick = (tag: string) => {
  const normalizedTag = tag.trim().toLowerCase();
  const backRouteName = (route.meta.backRoute as string) || 'board';
  router.replace({
    name: backRouteName,
    params: { projectId: projectId.value },
    query: {
      ...route.query,
      tags: normalizedTag,
    },
  });
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

const fetchTaskDetail = async (id: string) => {
  loading.value = true;
  error.value = null;
  try {
    let resolvedProjId = projectId.value;
    if (resolvedProjId === 'all') {
      if (tasks.value.length === 0) {
        await projectStore.fetchTasks({ projectId: 'all' });
      }
      const foundTask = tasks.value.find((t) => String(t.id) === id);
      if (foundTask) {
        resolvedProjId = foundTask.project_id;
      } else {
        throw new Error('Task not found in global projects list');
      }
    }
    const fetchedTask = await getTask(resolvedProjId, id);
    task.value = fetchedTask;
    initEditState(fetchedTask);
  } catch (err: any) {
    error.value = t('errors.loadTask', { message: err.message || err });
  } finally {
    loading.value = false;
  }
};

// Fetch task detail when taskId changes
watch(
  taskId,
  async (newId) => {
    if (newId !== null) {
      await fetchTaskDetail(newId);
    } else {
      task.value = null;
      isEditing.value = false;
    }
  },
  { immediate: true }
);

const addChecklistItem = () => {
  editorAddChecklistItem(() => editFieldsRef.value?.markdownEditorRef);
};

const handleUpdateTaskFromAttachments = (updated: Task) => {
  task.value = updated;
  refreshBoard();
};

const handlePreviewImage = (filename: string) => {
  if (!task.value) return;
  previewImageName.value = filename;
  previewImageUrl.value = getAttachmentUrl(actualProjectId.value, task.value.id, filename);
};

const handleSave = async () => {
  loading.value = true;
  error.value = null;
  await editorHandleSave(
    (updated) => {
      task.value = updated;
      if (task.value) {
        task.value.tags = task.value.tags ?? [];
      }
      loading.value = false;
    },
    (err) => {
      if (err.message === 'titleRequired') {
        error.value = t('errors.titleRequired');
      } else {
        error.value = t('errors.updateTask', { message: err.message || err });
      }
      loading.value = false;
    }
  );
};

const refreshBoard = () => {
  emit('refresh');
};

const { toggleCheckboxInBody, splitAllSubtasks, deleteCurrentTask, markDone, archive, unarchive } = useTaskDetailActions({
  task,
  buckets,
  actualProjectId,
  patchTask,
  editForm,
  loading,
  error,
  closeModal,
  refreshBoard,
});

// Dropping files anywhere on the modal uploads them as attachments (view mode only)
const { isDragging, onDragOver, onDragLeave, onDrop } = useFileDrop((files) => detailViewRef.value?.uploadFiles(files));

const handleDblClick = (event: MouseEvent) => {
  if (isEditing.value) return;

  const target = event.target as HTMLElement | null;
  if (!target) return;

  const ignoreTags = ['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'TEXTAREA', 'A', 'H2'];
  if (
    ignoreTags.includes(target.tagName) ||
    target.closest('button') ||
    target.closest('a') ||
    target.closest('h2') ||
    target.closest('.task-title') ||
    target.closest('[data-no-dblclick-edit]')
  ) {
    return;
  }

  isEditing.value = true;
  nextTick(() => {
    editFieldsRef.value?.focusTitle();
  });
};

onBeforeRouteLeave(async () => {
  if (isEditing.value) {
    const bucketNames = buckets.value.map((b) => b.name);
    const parseResult = parseTitleState(editForm.title, locale.value, bucketNames, editForm.ignoredKeywords);
    const finalTitle = parseResult.cleanTitle;

    if (finalTitle) {
      await handleSave();
      if (isEditing.value) {
        // Saving failed (e.g. due to validation or API error), stay on the route
        return false;
      }
    } else {
      cancelEdit();
    }
  }
  return true;
});
</script>

<template>
  <BaseModal :is-open="true" max-width="max-w-3xl" content-class="md:max-h-[85vh] relative" :show-close-button="false" @close="closeModal">
    <!-- Full Drag & Drop Overlay -->
    <Transition name="fade">
      <div
        v-if="isDragging"
        class="absolute inset-0 z-40 bg-theme-base/95 backdrop-blur-md border-2 border-dashed border-theme-accent m-2 rounded flex flex-col items-center justify-center gap-2 pointer-events-none transition-all duration-200"
      >
        <div class="p-3.5 bg-theme-accent/10 text-theme-accent rounded-full animate-bounce">
          <span class="text-2xl">📎</span>
        </div>
        <p class="text-theme-text-main font-bold text-sm">{{ t('form.dragDropTitle') }}</p>
        <p class="text-theme-text-muted text-xs">{{ t('form.dragDropSubtitle') }}</p>
      </div>
    </Transition>

    <button
      @click="closeModal"
      class="text-slate-400 transition-colors p-1 rounded cursor-pointer hover:text-white z-20"
      style="position: absolute; top: 10px; right: 10px"
    >
      <X class="w-4 h-4 shrink-0" />
    </button>

    <div
      class="flex flex-col flex-grow overflow-hidden"
      @dblclick="handleDblClick"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- Error alert -->
      <div v-if="error" class="mx-4 mt-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
        {{ error }}
      </div>

      <!-- Main Body -->
      <div class="p-4 overflow-y-auto flex-grow scroller-thin">
        <!-- Loading State -->
        <div v-if="loading && !task" class="flex flex-col items-center justify-center py-12 gap-3">
          <div class="w-8 h-8 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
          <span class="text-slate-400 text-xs">{{ t('loadingTask') }}</span>
        </div>

        <div v-else-if="task">
          <TaskDetailView
            v-if="!isEditing"
            ref="detailViewRef"
            :task="task"
            :project-id="actualProjectId"
            :has-checklist="hasChecklist"
            @tag-click="handleTagClick"
            @update-body="toggleCheckboxInBody"
            @split-subtasks="splitAllSubtasks"
            @add-checklist="addChecklistItem"
            @update-task="handleUpdateTaskFromAttachments"
            @error="error = $event"
            @preview-image="handlePreviewImage"
          />

          <!-- Edit Mode -->
          <TaskEditFields v-else ref="editFieldsRef" :buckets="buckets" @add-checklist="addChecklistItem" />
        </div>
      </div>

      <TaskDetailFooter
        :task="task"
        :is-editing="isEditing"
        :loading="loading"
        @delete="deleteCurrentTask"
        @archive="archive"
        @unarchive="unarchive"
        @mark-done="markDone"
        @edit="isEditing = true"
        @cancel="cancelEdit"
        @save="handleSave"
      />
    </div>
  </BaseModal>

  <!-- Image Preview Lightbox Overlay -->
  <TaskImageLightbox :image-url="previewImageUrl" :image-name="previewImageName" @close="previewImageUrl = null" />
</template>
