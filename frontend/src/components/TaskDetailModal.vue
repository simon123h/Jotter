<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { marked } from 'marked';
import type { Task, BucketName } from '../types';
import { getTask, updateTask, deleteTask } from '../api';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
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
    const fetchedTask = await getTask(id);
    task.value = fetchedTask;
    // Set edit form values
    editTitle.value = fetchedTask.title;
    editBucket.value = fetchedTask.bucket;
    editTags.value = fetchedTask.tags.join(', ');
    editBody.value = fetchedTask.body;
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

    const updated = await updateTask(task.value.id, {
      title: editTitle.value,
      bucket: editBucket.value,
      tags: tagArray,
      body: editBody.value,
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
  if (!confirm(t('deleteConfirm'))) return;

  loading.value = true;
  error.value = null;
  try {
    await deleteTask(task.value.id);
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
  }
  isEditing.value = false;
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Content -->
    <div
      class="relative bg-theme-base border border-theme-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
        <div class="flex items-center gap-3">
          <span class="text-xs font-mono px-2 py-1 bg-theme-card text-slate-400 rounded-md border border-theme-border">
            {{ t('detailModalTitle', { id: taskId || '' }) }}
          </span>
          <span
            v-if="task && !isEditing"
            class="text-xs uppercase font-bold px-2.5 py-0.5 rounded-full bg-theme-primary/10 text-theme-accent border border-theme-accent/20"
          >
            {{ t('buckets.' + task.bucket) }}
          </span>
        </div>
        <button
          @click="emit('close')"
          class="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-theme-card rounded-lg cursor-pointer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Error alert -->
      <div v-if="error" class="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
        {{ error }}
      </div>

      <!-- Main Body -->
      <div class="p-6 overflow-y-auto flex-grow">
        <!-- Loading State -->
        <div v-if="loading && !task" class="flex flex-col items-center justify-center py-12 gap-3">
          <div class="w-10 h-10 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
          <span class="text-slate-400 text-sm">{{ t('loadingTask') }}</span>
        </div>

        <div v-else-if="task">
          <!-- View Mode -->
          <div v-if="!isEditing" class="space-y-6">
            <div>
              <h2 class="text-2xl font-bold text-theme-text-main mb-2 leading-snug">
                {{ task.title }}
              </h2>

              <!-- Tags -->
              <div v-if="task.tags.length" class="flex flex-wrap gap-1.5 mt-3">
                <span
                  v-for="tag in task.tags"
                  :key="tag"
                  class="text-xs font-semibold px-2.5 py-0.5 bg-theme-card text-theme-text-card border border-theme-border rounded-md"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <div class="border-t border-theme-border pt-6">
              <h4 class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-3">{{ t('notesLabel') }}</h4>

              <!-- Rendered Markdown -->
              <div
                v-if="task.body"
                class="markdown-content text-theme-text-card prose prose-invert max-w-none space-y-4"
                v-html="parsedMarkdown"
              ></div>
              <div v-else class="text-theme-text-muted italic text-sm py-4">{{ t('noDescription') }}</div>
            </div>

            <div class="text-[11px] text-theme-text-muted flex gap-4 border-t border-theme-border pt-4 font-mono">
              <span>{{ t('timestampCreated', { date: new Date(task.created_at).toLocaleString() }) }}</span>
              <span>{{ t('timestampUpdated', { date: new Date(task.updated_at).toLocaleString() }) }}</span>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="space-y-4">
            <!-- Title -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">{{
                t('form.titleLabel')
              }}</label>
              <input
                v-model="editTitle"
                type="text"
                class="w-full bg-theme-base/60 border border-theme-border rounded-xl px-4 py-2.5 text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                :placeholder="t('form.titlePlaceholder')"
              />
            </div>

            <!-- Bucket & Tags Row -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">{{
                  t('form.columnLabel')
                }}</label>
                <select
                  v-model="editBucket"
                  class="w-full bg-theme-base/60 border border-theme-border rounded-xl px-4 py-2.5 text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                >
                  <option v-for="b in buckets" :key="b.name" :value="b.name">{{ t('buckets.' + b.name) }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">{{
                  t('form.tagsLabel')
                }}</label>
                <input
                  v-model="editTags"
                  type="text"
                  class="w-full bg-theme-base/60 border border-theme-border rounded-xl px-4 py-2.5 text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                  :placeholder="t('form.tagsPlaceholderEdit')"
                />
              </div>
            </div>

            <!-- Body (Markdown Textarea) -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
                {{ t('form.markdownLabelEdit') }}
              </label>
              <textarea
                v-model="editBody"
                rows="10"
                class="w-full bg-theme-base/60 border border-theme-border rounded-xl p-4 text-theme-text-input font-mono text-sm focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                :placeholder="t('form.markdownPlaceholderEdit')"
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-6 py-4 border-t border-theme-border flex justify-between items-center bg-theme-card/30 shrink-0">
        <div>
          <button
            v-if="task && !isEditing"
            @click="handleDelete"
            class="text-xs font-semibold px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors cursor-pointer"
          >
            {{ t('buttons.delete') }}
          </button>
        </div>
        <div class="flex gap-2">
          <!-- View mode buttons -->
          <template v-if="!isEditing">
            <button
              @click="isEditing = true"
              class="text-xs font-semibold px-4.5 py-2 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded-xl transition-all cursor-pointer"
            >
              {{ t('buttons.edit') }}
            </button>
            <button
              @click="emit('close')"
              class="text-xs font-semibold px-4.5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-xl shadow-md hover:shadow-theme-ring transition-all cursor-pointer"
            >
              {{ t('buttons.close') }}
            </button>
          </template>

          <!-- Edit mode buttons -->
          <template v-else>
            <button
              @click="cancelEdit"
              class="text-xs font-semibold px-4.5 py-2 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded-xl transition-all cursor-pointer"
              :disabled="loading"
            >
              {{ t('buttons.cancel') }}
            </button>
            <button
              @click="handleSave"
              class="text-xs font-semibold px-4.5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-xl shadow-md hover:shadow-theme-ring transition-all flex items-center gap-2 cursor-pointer"
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
