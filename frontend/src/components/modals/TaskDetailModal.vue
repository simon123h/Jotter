<script setup lang="ts">
import { ref, watch, computed, onUnmounted, nextTick, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { storeToRefs } from 'pinia';
import type { Task } from '@/types';
import { getTask, deleteTask, getAttachmentUrl } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { useProjectStore } from '@/stores/project';
import { X, Slash, ClipboardList } from '@lucide/vue';
import { parseTitleState } from '@/utils/titleParser';
import MarkdownEditor from '@/components/ui/MarkdownEditor.vue';
import KeywordHighlightInput from '@/components/ui/KeywordHighlightInput.vue';
import TagInput from '@/components/ui/TagInput.vue';
import { TASK_COLORS } from '@/utils/constants';

// Refactored modular sub-components and composables
import { useTaskEditor } from '@/features/task-editor/composables/useTaskEditor';
import TaskChecklist from '@/features/task-editor/components/TaskChecklist.vue';
import TaskAttachments from '@/features/task-editor/components/TaskAttachments.vue';

const { locale, t, tBucket } = useI18n();
const { showDialog } = useDialog();
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

const colors = TASK_COLORS;
const titleInput = ref<any>(null);
const markdownEditor = ref<any>(null);
const attachmentsRef = ref<any>(null);

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
const {
  isEditing,
  editTitle,
  ignoredKeywords,
  editBucket,
  editTags,
  editBody,
  editDueDate,
  editPlannedDate,
  editPriority,
  editColor,
  showAutocomplete,
  autocompleteIndex,
  filteredBuckets,
  checkAutocomplete,
  selectAutocompleteItem,
  handleTitleKeyDown,
  initEditState,
  cancelEdit,
  handleSave: editorHandleSave,
  addChecklistItem: editorAddChecklistItem,
  hasChecklist,
} = useTaskEditor({
  task,
  buckets,
  locale,
  patchTask,
  titleInput,
});

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

const toggleCheckboxInBody = async (newBody: string) => {
  if (!task.value) return;
  try {
    const updated = await patchTask(task.value, { body: newBody });
    task.value = updated;
  } catch (err: any) {
    error.value = t('errors.updateTask', { message: err.message || err });
  }
};

const addChecklistItem = () => {
  editorAddChecklistItem(markdownEditor);
};

// Full-modal Drag & Drop orchestration mapped straight into `<TaskAttachments>`
const isDragging = ref(false);

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer?.types.includes('Files')) {
    isDragging.value = true;
  }
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0 && attachmentsRef.value) {
    await attachmentsRef.value.uploadFiles(files);
  }
};

const handleUpdateTaskFromAttachments = (updated: Task) => {
  task.value = updated;
  refreshBoard();
};

const handleAttachmentsError = (message: string) => {
  error.value = message;
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

const handleDelete = async () => {
  if (!task.value) return;
  const confirmed = await showDialog({
    title: t('buttons.deleteTask'),
    message: t('deleteConfirm'),
    type: 'warning',
    showCancel: true,
    confirmText: t('buttons.delete'),
    cancelText: t('buttons.cancel'),
  });
  if (!confirmed) return;

  loading.value = true;
  error.value = null;
  try {
    await deleteTask(actualProjectId.value, task.value.id);
    refreshBoard();
    closeModal();
  } catch (err: any) {
    error.value = t('errors.deleteTask', { message: err.message || err });
    loading.value = false;
  }
};

const handleMarkDone = async () => {
  if (!task.value) return;
  try {
    await patchTask(task.value, {
      bucket: 'done',
      position: 1000000.0,
    });
    closeModal();
  } catch (err: any) {
    error.value = t('errors.updateTask', { message: err.message || err });
  }
};

const handleArchive = async () => {
  if (!task.value) return;
  try {
    const updated = await patchTask(task.value, {
      bucket: 'archive',
    });
    task.value = updated;
    closeModal();
  } catch (err: any) {
    error.value = t('errors.updateTask', { message: err.message || err });
  }
};

const handleUnarchive = async () => {
  if (!task.value) return;
  try {
    const targetBucket = buckets.value.find((b) => b.name === 'todo')?.name || buckets.value[0]?.name || 'todo';
    const updated = await patchTask(task.value, {
      bucket: targetBucket,
    });
    task.value = updated;
    closeModal();
  } catch (err: any) {
    error.value = t('errors.updateTask', { message: err.message || err });
  }
};

const refreshBoard = () => {
  emit('refresh');
};

const getPriorityClasses = (prio: string) => {
  switch (prio) {
    case 'low':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25';
    case 'high':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/25';
    case 'urgent':
      return 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  }
};

const handleDblClick = (event: MouseEvent) => {
  if (isEditing.value) return;

  const target = event.target as HTMLElement | null;
  if (!target) return;

  const ignoreTags = ['BUTTON', 'INPUT', 'SELECT', 'OPTION', 'TEXTAREA', 'A'];
  if (ignoreTags.includes(target.tagName) || target.closest('button') || target.closest('a')) {
    return;
  }

  isEditing.value = true;
  nextTick(() => {
    titleInput.value?.focus();
  });
};

onBeforeRouteLeave(async () => {
  if (isEditing.value) {
    const bucketNames = buckets.value.map((b) => b.name);
    const parseResult = parseTitleState(editTitle.value, locale.value, bucketNames, ignoredKeywords.value);
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
  <Transition name="modal" appear>
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="closeModal"></div>

      <!-- Modal Content -->
      <div
        class="relative bg-theme-base border border-theme-border w-full max-w-3xl rounded shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
        @dblclick="handleDblClick"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
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
          class="text-slate-400 transition-colors p-1 rounded cursor-pointer hover:text-white"
          style="position: absolute; top: 10px; right: 10px"
        >
          <X class="w-4 h-4 shrink-0" />
        </button>

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
            <!-- View Mode -->
            <div v-if="!isEditing" class="space-y-4">
              <div>
                <h2 class="text-xl font-bold text-theme-text-main mb-1.5 leading-snug">
                  {{ task.title }}
                </h2>

                <!-- Tags -->
                <div v-if="task.tags?.length" class="flex flex-wrap gap-1 mt-2">
                  <span
                    v-for="tag in task.tags"
                    :key="tag"
                    class="text-xs font-semibold px-2 py-0.5 bg-theme-card text-theme-text-card border border-theme-border rounded cursor-pointer transition-transform hover:scale-105"
                    @click="handleTagClick(tag)"
                  >
                    {{ tag }}
                  </span>
                </div>

                <!-- Due Date, Planned Date & Priority Info -->
                <div v-if="task.due_date || task.planned_date || task.priority" class="flex flex-wrap gap-3.5 mt-3 items-center">
                  <div v-if="task.due_date" class="flex items-center gap-1.5 text-xs">
                    <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Due:</span>
                    <span class="bg-theme-card px-2 py-0.5 rounded border border-theme-border text-xs font-semibold text-theme-text-card">
                      {{ new Date(task.due_date).toLocaleDateString() }}
                    </span>
                  </div>
                  <div v-if="task.planned_date" class="flex items-center gap-1.5 text-xs">
                    <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Planned:</span>
                    <span class="bg-theme-card px-2 py-0.5 rounded border border-theme-border text-xs font-semibold text-theme-text-card">
                      {{ t('plannedDateOptions.' + task.planned_date) }}
                    </span>
                  </div>
                  <div v-if="task.priority" class="flex items-center gap-1.5 text-xs">
                    <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Priority:</span>
                    <span
                      class="px-2 py-0.5 rounded border text-xs font-extrabold uppercase tracking-wider"
                      :class="getPriorityClasses(task.priority)"
                    >
                      {{ t('priorityOptions.' + task.priority) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="border-t border-theme-border pt-4">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('notesLabel') }}</h4>
                  <button
                    v-if="!hasChecklist"
                    type="button"
                    @click="addChecklistItem"
                    class="text-xs font-semibold px-2 py-1 bg-theme-column hover:bg-theme-column/80 text-theme-text-main border border-theme-border rounded flex items-center gap-1 transition-all cursor-pointer hover:border-theme-accent hover:text-theme-accent"
                  >
                    <ClipboardList class="w-3.5 h-3.5" />
                    {{ t('form.quickAddChecklist') }}
                  </button>
                </div>

                <!-- Rendered Markdown with interactive checkboxes -->
                <TaskChecklist :body="task.body" @update:body="toggleCheckboxInBody" @error="error = $event" />
              </div>

              <div class="text-xs text-theme-text-muted flex gap-4 border-t border-theme-border pt-3 font-mono">
                <span>{{ t('timestampCreated', { date: new Date(task.created_at).toLocaleString() }) }}</span>
                <span>{{ t('timestampUpdated', { date: new Date(task.updated_at).toLocaleString() }) }}</span>
              </div>

              <!-- Attachments subcomponent -->
              <TaskAttachments
                ref="attachmentsRef"
                :project-id="actualProjectId"
                :task-id="task.id"
                :attachments="task.attachments ?? []"
                @update-task="handleUpdateTaskFromAttachments"
                @error="handleAttachmentsError"
                @preview-image="handlePreviewImage"
              />
            </div>

            <!-- Edit Mode -->
            <div v-else class="space-y-3">
              <!-- Title -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                  t('form.titleLabel')
                }}</label>
                <div class="relative">
                  <KeywordHighlightInput
                    ref="titleInput"
                    v-model="editTitle"
                    v-model:ignored-keywords="ignoredKeywords"
                    :bucket-names="buckets.map((b) => b.name)"
                    :locale="locale"
                    :placeholder="t('form.titlePlaceholder')"
                    :required="true"
                    @input="checkAutocomplete"
                    @click="checkAutocomplete"
                    @keyup="checkAutocomplete"
                    @keydown="handleTitleKeyDown"
                    @blur="showAutocomplete = false"
                  />
                  <!-- Autocomplete Popup -->
                  <div
                    v-if="showAutocomplete"
                    class="absolute left-0 right-0 top-full mt-1 z-50 bg-theme-base border border-theme-border rounded shadow-xl max-h-48 overflow-y-auto py-1 scroller-thin"
                  >
                    <div
                      v-for="(b, index) in filteredBuckets"
                      :key="b.name"
                      @mousedown.prevent="selectAutocompleteItem(b.name)"
                      @mouseenter="autocompleteIndex = index"
                      class="px-3 py-1.5 text-sm flex items-center justify-between cursor-pointer transition-colors"
                      :class="
                        index === autocompleteIndex
                          ? 'bg-theme-primary text-white font-semibold'
                          : 'text-theme-text-main hover:bg-theme-card/60'
                      "
                    >
                      <div class="flex items-center gap-2">
                        <span
                          class="w-1.5 h-1.5 rounded-full bg-theme-accent"
                          :class="index === autocompleteIndex ? 'bg-white' : ''"
                        ></span>
                        <span>{{ tBucket(b.name, b.title) }}</span>
                      </div>
                      <span class="text-xs font-mono" :class="index === autocompleteIndex ? 'text-white/80' : 'text-theme-text-muted'"
                        >/{{ b.name }}</span
                      >
                    </div>
                    <div v-if="filteredBuckets.length === 0" class="px-3 py-2 text-xs text-theme-text-muted italic">
                      {{ t('form.noBucketsFound') }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bucket & Tags Row -->
              <div class="grid grid-cols-2 gap-3.5">
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                    t('form.columnLabel')
                  }}</label>
                  <select
                    v-model="editBucket"
                    class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                  >
                    <option v-for="b in buckets" :key="b.name" :value="b.name">{{ tBucket(b.name, b.title) }}</option>
                  </select>
                </div>
                <div class="relative">
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                    t('form.tagsLabel')
                  }}</label>
                  <TagInput v-model="editTags" :placeholder="t('form.tagsPlaceholderEdit')" />
                </div>
              </div>

              <!-- Due Date, Planned Date & Priority Row -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                    t('form.dueDateLabel')
                  }}</label>
                  <input
                    v-model="editDueDate"
                    type="date"
                    class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                    t('form.plannedDateLabel') || 'Planned'
                  }}</label>
                  <select
                    v-model="editPlannedDate"
                    class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                  >
                    <option value="">{{ t('plannedDateOptions.none') }}</option>
                    <option value="today">{{ t('plannedDateOptions.today') }}</option>
                    <option value="tomorrow">{{ t('plannedDateOptions.tomorrow') }}</option>
                    <option value="thisWeek">{{ t('plannedDateOptions.thisWeek') }}</option>
                    <option value="thisMonth">{{ t('plannedDateOptions.thisMonth') }}</option>
                    <option value="thisYear">{{ t('plannedDateOptions.thisYear') }}</option>
                    <option value="sometime">{{ t('plannedDateOptions.sometime') }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                    t('form.priorityLabel')
                  }}</label>
                  <select
                    v-model="editPriority"
                    class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                  >
                    <option value="">{{ t('priorityOptions.none') }}</option>
                    <option value="low">{{ t('priorityOptions.low') }}</option>
                    <option value="medium">{{ t('priorityOptions.medium') }}</option>
                    <option value="high">{{ t('priorityOptions.high') }}</option>
                    <option value="urgent">{{ t('priorityOptions.urgent') }}</option>
                  </select>
                </div>
              </div>

              <!-- Highlight Color Selector -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
                  {{ t('columnEdit.colorLabel') }}
                </label>
                <div class="flex flex-wrap gap-2.5 items-center">
                  <!-- None Option -->
                  <button
                    type="button"
                    @click="editColor = null"
                    class="w-7 h-7 rounded-full border border-theme-border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 text-theme-text-muted hover:text-theme-text-main"
                    :class="[
                      editColor === null
                        ? 'ring-2 ring-theme-accent ring-offset-2 ring-offset-theme-base bg-theme-card/80 border-theme-accent/60'
                        : 'bg-theme-card/30 hover:bg-theme-card',
                    ]"
                    :title="t('columnEdit.colorNone')"
                  >
                    <Slash class="w-3 h-3 shrink-0 rotate-90" />
                  </button>

                  <!-- Colors -->
                  <button
                    v-for="c in colors"
                    :key="c.id"
                    type="button"
                    @click="editColor = c.id"
                    class="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95"
                    :class="[c.bg, editColor === c.id ? `ring-2 ring-offset-2 ring-offset-theme-base ${c.ring}` : '']"
                    :title="c.name"
                  />
                </div>
              </div>

              <!-- Body (Markdown Editor) -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted">
                    {{ t('form.markdownLabelEdit') }}
                  </label>
                  <button
                    v-if="!hasChecklist"
                    type="button"
                    @click="addChecklistItem"
                    class="text-xs font-semibold px-2 py-1 bg-theme-column hover:bg-theme-column/80 text-theme-text-main border border-theme-border rounded flex items-center gap-1 transition-all cursor-pointer hover:border-theme-accent hover:text-theme-accent"
                  >
                    <ClipboardList class="w-3.5 h-3.5" />
                    {{ t('form.quickAddChecklist') }}
                  </button>
                </div>
                <MarkdownEditor ref="markdownEditor" v-model="editBody" :rows="12" :placeholder="t('form.markdownPlaceholderEdit')" />
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Buttons -->
        <div class="px-4 py-3 border-t border-theme-border flex justify-between items-center bg-theme-card/30 shrink-0">
          <div>
            <button
              v-if="task && !isEditing"
              @click="handleDelete"
              class="text-sm font-semibold px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors cursor-pointer"
            >
              {{ t('buttons.delete') }}
            </button>
          </div>
          <div class="flex gap-2">
            <!-- View mode buttons -->
            <template v-if="!isEditing">
              <button
                v-if="task && task.bucket !== 'archive'"
                @click="handleArchive"
                class="text-sm font-semibold px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 rounded transition-all cursor-pointer"
              >
                {{ t('buttons.archive') }}
              </button>
              <button
                v-if="task && task.bucket === 'archive'"
                @click="handleUnarchive"
                class="text-sm font-semibold px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded transition-all cursor-pointer"
              >
                {{ t('buttons.unarchive') }}
              </button>
              <button
                v-if="task && task.bucket !== 'done' && task.bucket !== 'archive'"
                @click="handleMarkDone"
                class="text-sm font-semibold px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all cursor-pointer"
              >
                {{ t('buttons.markDone') }}
              </button>
              <button
                @click="isEditing = true"
                class="text-sm font-semibold px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25 rounded transition-all cursor-pointer"
              >
                {{ t('buttons.edit') }}
              </button>
            </template>

            <!-- Edit mode buttons -->
            <template v-else>
              <button
                @click="cancelEdit"
                class="text-sm font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
                :disabled="loading"
              >
                {{ t('buttons.cancel') }}
              </button>
              <button
                @click="handleSave"
                class="text-sm font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                :disabled="loading"
              >
                <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {{ t('buttons.save') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Image Preview Lightbox Overlay -->
  <Transition name="fade">
    <div
      v-if="previewImageUrl"
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 select-none animate-fade-in"
      @click="previewImageUrl = null"
    >
      <!-- Header Bar inside Lightbox -->
      <div
        class="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10 pointer-events-auto"
      >
        <span class="text-white text-sm font-semibold truncate max-w-[70%] px-2">{{ previewImageName }}</span>
        <div class="flex items-center gap-3">
          <a
            :href="previewImageUrl"
            target="_blank"
            download
            class="text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer flex items-center justify-center"
            :title="t('buttons.download')"
            @click.stop
          >
            <!-- Custom simple SVG or Lucide to avoid downloads breaking -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
          <button
            @click="previewImageUrl = null"
            class="text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer flex items-center justify-center"
            :title="t('buttons.close')"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Main Image Container -->
      <div class="relative max-w-full max-h-[85vh] flex items-center justify-center animate-scale-in" @click.stop>
        <img
          :src="previewImageUrl"
          :alt="previewImageName"
          class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-white/10"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
