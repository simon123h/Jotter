<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { marked } from 'marked';
import type { Task, BucketName } from '../types';
import { getTask, updateTask, deleteTask } from '../api';
import { useI18n } from '../composables/useI18n';
import { useDialog } from '../composables/useDialog';
import { X } from '@lucide/vue';

const { t } = useI18n();
const { showDialog } = useDialog();

const props = defineProps<{
  isOpen: boolean;
  projectId: string;
  taskId: number | null;
  buckets: { name: BucketName; title: string }[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
  (e: 'deleted'): void;
}>();

const task = ref<Task | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const isEditing = ref(false);

// Edit state
const editTitle = ref('');
const editBucket = ref<string>('todo');
const editTags = ref('');
const editBody = ref('');
const editDueDate = ref('');
const editPriority = ref('');

// Fetch task detail when modal opens or taskId changes
watch(
  () => props.taskId,
  async (newId) => {
    if (newId !== null && props.isOpen) {
      await fetchTaskDetail(newId);
    } else {
      task.value = null;
      isEditing.value = false;
    }
  }
);

watch(
  () => props.isOpen,
  async (open) => {
    if (open && props.taskId !== null) {
      await fetchTaskDetail(props.taskId);
    }
  }
);

const fetchTaskDetail = async (id: number) => {
  loading.value = true;
  error.value = null;
  try {
    const fetchedTask = await getTask(props.projectId, id);
    task.value = fetchedTask;
    // Set edit form values
    editTitle.value = fetchedTask.title;
    editBucket.value = fetchedTask.bucket;
    editTags.value = fetchedTask.tags.join(', ');
    editBody.value = fetchedTask.body;
    editDueDate.value = fetchedTask.due_date || '';
    editPriority.value = fetchedTask.priority || '';
  } catch (err: any) {
    error.value = t('errors.loadTask', { message: err.message || err });
  } finally {
    loading.value = false;
  }
};

// Compile Markdown body safely
const parsedMarkdown = computed(() => {
  if (!task.value || !task.value.body) return '';
  try {
    return marked.parse(task.value.body);
  } catch {
    return task.value.body;
  }
});

const handleSave = async () => {
  if (!task.value) return;

  loading.value = true;
  error.value = null;
  try {
    // Process tags (split by comma and trim)
    const tagArray = editTags.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const updated = await updateTask(props.projectId, task.value.id, {
      title: editTitle.value,
      bucket: editBucket.value,
      tags: tagArray,
      body: editBody.value,
      due_date: editDueDate.value,
      priority: editPriority.value,
    });

    task.value = updated;
    isEditing.value = false;
    emit('updated');
  } catch (err: any) {
    error.value = t('errors.updateTask', { message: err.message || err });
  } finally {
    loading.value = false;
  }
};

const handleDelete = async () => {
  if (!task.value) return;
  const confirmed = await showDialog({
    title: t('buttons.delete'),
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
    await deleteTask(props.projectId, task.value.id);
    emit('deleted');
    emit('close');
  } catch (err: any) {
    error.value = t('errors.deleteTask', { message: err.message || err });
    loading.value = false;
  }
};

const cancelEdit = () => {
  if (task.value) {
    editTitle.value = task.value.title;
    editBucket.value = task.value.bucket;
    editTags.value = task.value.tags.join(', ');
    editBody.value = task.value.body;
    editDueDate.value = task.value.due_date || '';
    editPriority.value = task.value.priority || '';
  }
  isEditing.value = false;
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
</script>

<template>
  <transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

      <!-- Modal Content -->
      <div
        class="relative bg-theme-base border border-theme-border w-full max-w-3xl rounded shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
      >
        <!-- Header -->
        <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
          <div class="flex items-center gap-3">
            <span class="text-xs font-mono px-2 py-0.5 bg-theme-card text-slate-400 rounded border border-theme-border">
              {{ t('detailModalTitle', { id: taskId || '' }) }}
            </span>
            <span
              v-if="task && !isEditing"
              class="text-xs uppercase font-bold px-2 py-0.5 rounded bg-theme-primary/10 text-theme-accent border border-theme-accent/20"
            >
              {{ t('buckets.' + task.bucket) }}
            </span>
          </div>
          <button
            @click="emit('close')"
            class="text-slate-400 hover:text-white transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
          >
            <X class="w-4 h-4 shrink-0" />
          </button>
        </div>

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
                <div v-if="task.tags.length" class="flex flex-wrap gap-1 mt-2">
                  <span
                    v-for="tag in task.tags"
                    :key="tag"
                    class="text-xs font-semibold px-2 py-0.5 bg-theme-card text-theme-text-card border border-theme-border rounded"
                  >
                    {{ tag }}
                  </span>
                </div>

                <!-- Due Date & Priority Info -->
                <div v-if="task.due_date || task.priority" class="flex flex-wrap gap-3.5 mt-3 items-center">
                  <div v-if="task.due_date" class="flex items-center gap-1.5 text-xs">
                    <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Due:</span>
                    <span class="bg-theme-card px-2 py-0.5 rounded border border-theme-border text-xs font-semibold text-theme-text-card">
                      {{ new Date(task.due_date).toLocaleDateString() }}
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
                <h4 class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-2">{{ t('notesLabel') }}</h4>

                <!-- Rendered Markdown -->
                <div
                  v-if="task.body"
                  class="markdown-content text-theme-text-card prose prose-invert max-w-none space-y-3 break-all"
                  v-html="parsedMarkdown"
                ></div>
                <div v-else class="text-theme-text-muted italic text-xs py-2">{{ t('noDescription') }}</div>
              </div>

              <div class="text-xs text-theme-text-muted flex gap-4 border-t border-theme-border pt-3 font-mono">
                <span>{{ t('timestampCreated', { date: new Date(task.created_at).toLocaleString() }) }}</span>
                <span>{{ t('timestampUpdated', { date: new Date(task.updated_at).toLocaleString() }) }}</span>
              </div>
            </div>

            <!-- Edit Mode -->
            <div v-else class="space-y-3">
              <!-- Title -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                  t('form.titleLabel')
                }}</label>
                <input
                  v-model="editTitle"
                  type="text"
                  class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                  :placeholder="t('form.titlePlaceholder')"
                />
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
                    <option v-for="b in buckets" :key="b.name" :value="b.name">{{ t('buckets.' + b.name) }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                    t('form.tagsLabel')
                  }}</label>
                  <input
                    v-model="editTags"
                    type="text"
                    class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                    :placeholder="t('form.tagsPlaceholderEdit')"
                  />
                </div>
              </div>

              <!-- Due Date & Priority Row -->
              <div class="grid grid-cols-2 gap-3.5">
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

              <!-- Body (Markdown Textarea) -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                  {{ t('form.markdownLabelEdit') }}
                </label>
                <textarea
                  v-model="editBody"
                  rows="10"
                  class="w-full bg-theme-base/60 border border-theme-border rounded p-3 text-sm text-theme-text-input font-mono focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring scroller-thin"
                  :placeholder="t('form.markdownPlaceholderEdit')"
                ></textarea>
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
                @click="isEditing = true"
                class="text-sm font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
              >
                {{ t('buttons.edit') }}
              </button>
              <button
                @click="emit('close')"
                class="text-sm font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all cursor-pointer"
              >
                {{ t('buttons.close') }}
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
  </transition>
</template>

<style>
/* Style rendered markdown headers and checklists inside the modal */
.markdown-content h1 {
  font-size: 1.4rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: #f8fafc;
}
.markdown-content h2 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: #f8fafc;
}
.markdown-content h3 {
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
  color: #f1f5f9;
}
.markdown-content ul {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.markdown-content ol {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.markdown-content li {
  margin-bottom: 0.25rem;
}
.markdown-content p {
  margin-bottom: 0.75rem;
  line-height: 1.6;
}
.markdown-content code {
  background-color: var(--theme-bg-card);
  padding: 0.15rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
  color: var(--theme-accent);
}
.markdown-content pre {
  background-color: var(--theme-bg-base);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 0.75rem;
}
.markdown-content pre code {
  background-color: transparent;
  padding: 0;
  color: inherit;
}
.markdown-content a {
  color: var(--theme-accent);
  text-decoration: underline;
}
.markdown-content a:hover {
  color: var(--theme-accent-hover);
}
.markdown-content blockquote {
  border-left: 3px solid var(--theme-border);
  padding-left: 0.75rem;
  color: #94a3b8;
  font-style: italic;
  margin: 0.75rem 0;
}
.markdown-content input[type='checkbox'] {
  accent-color: var(--theme-primary);
  margin-right: 0.5rem;
  border-radius: 0.25rem;
}
</style>
