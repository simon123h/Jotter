<script setup lang="ts">
import { ref, watch, computed, onUnmounted, nextTick } from 'vue';
import { marked } from 'marked';
import type { Task, BucketName } from '@/types';
import { getTask, updateTask, deleteTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { X, Slash } from '@lucide/vue';
import { parseTitleState } from '@/utils/dateParser';

const { locale, t } = useI18n();
const { showDialog } = useDialog();

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    projectId: string;
    taskId: string | null;
    buckets: { name: BucketName; title: string }[];
    existingTags?: string[];
  }>(),
  {
    existingTags: () => [],
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
  (e: 'deleted'): void;
  (e: 'mark-done', task: Task): void;
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
const editColor = ref<string | null>(null);

const colors = [
  { id: 'red', name: 'Red', bg: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'orange', name: 'Orange', bg: 'bg-amber-600', ring: 'ring-amber-600' },
  { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-500' },
  { id: 'green', name: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
  { id: 'pink', name: 'Pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
];

const lastMatchedKeyword = ref<string | null>(null);
const lastMatchedPriority = ref<string | null>(null);
const lastExtractedTags = ref<string[]>([]);

const isTagDropdownOpen = ref(false);
const titleInput = ref<HTMLInputElement | null>(null);

const activeTagQuery = computed(() => {
  const parts = editTags.value.split(',');
  return parts[parts.length - 1].trim().toLowerCase();
});

const currentTagsSet = computed(() => {
  return new Set(
    editTags.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );
});

const tagSuggestions = computed(() => {
  const query = activeTagQuery.value;
  return props.existingTags.filter((tag) => {
    const normalizedTag = tag.toLowerCase();
    if (currentTagsSet.value.has(normalizedTag)) return false;
    return normalizedTag.includes(query);
  });
});

const selectTagSuggestion = (suggestion: string) => {
  const parts = editTags.value.split(',');
  parts[parts.length - 1] = ' ' + suggestion;
  editTags.value = parts.join(',').trim() + ', ';
  isTagDropdownOpen.value = true;
};

const activeSuggestionIndex = ref(0);

// Autocomplete State
const showAutocomplete = ref(false);
const autocompleteSearch = ref('');
const autocompleteIndex = ref(0);

const filteredBuckets = computed(() => {
  if (!showAutocomplete.value) return [];
  const search = autocompleteSearch.value.toLowerCase();
  return props.buckets.filter(
    (b) =>
      b.name.toLowerCase().includes(search) ||
      t('buckets.' + b.name)
        .toLowerCase()
        .includes(search)
  );
});

const checkAutocomplete = () => {
  const input = titleInput.value;
  if (!input) {
    showAutocomplete.value = false;
    return;
  }

  const value = editTitle.value;
  const cursor = input.selectionStart || 0;
  const textBeforeCursor = value.substring(0, cursor);

  const match = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9\u00C0-\u017F_-]*)$/);
  if (match) {
    showAutocomplete.value = true;
    autocompleteSearch.value = match[1];
    if (autocompleteIndex.value >= filteredBuckets.value.length) {
      autocompleteIndex.value = 0;
    }
  } else {
    showAutocomplete.value = false;
  }
};

const selectAutocompleteItem = (bucketName: string) => {
  const input = titleInput.value;
  if (!input) return;

  const value = editTitle.value;
  const cursor = input.selectionStart || 0;
  const slashIndex = cursor - autocompleteSearch.value.length - 1;

  if (slashIndex >= 0) {
    editTitle.value = value.substring(0, slashIndex) + '/' + bucketName + ' ' + value.substring(cursor);
    const newCursor = slashIndex + bucketName.length + 2;
    nextTick(() => {
      input.setSelectionRange(newCursor, newCursor);
      input.focus();
      checkAutocomplete();
    });
  }
  showAutocomplete.value = false;
};

// Reset active index when suggestions change
watch(tagSuggestions, () => {
  activeSuggestionIndex.value = 0;
});

const handleTitleKeyDown = (event: KeyboardEvent) => {
  if (showAutocomplete.value && filteredBuckets.value.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      autocompleteIndex.value = (autocompleteIndex.value + 1) % filteredBuckets.value.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      autocompleteIndex.value = (autocompleteIndex.value - 1 + filteredBuckets.value.length) % filteredBuckets.value.length;
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      selectAutocompleteItem(filteredBuckets.value[autocompleteIndex.value].name);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      showAutocomplete.value = false;
    }
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  // Tag Dropdown
  if (isEditing.value && isTagDropdownOpen.value && tagSuggestions.value.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % tagSuggestions.value.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeSuggestionIndex.value = (activeSuggestionIndex.value - 1 + tagSuggestions.value.length) % tagSuggestions.value.length;
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      selectTagSuggestion(tagSuggestions.value[activeSuggestionIndex.value]);
      isTagDropdownOpen.value = false;
      return;
    }
  }

  if (event.key === 'Escape' || event.key === 'Esc') {
    emit('close');
  } else if (event.ctrlKey && event.key === 'Enter') {
    if (isEditing.value) {
      event.preventDefault();
      handleSave();
    }
  }
};

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
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      if (props.taskId !== null) {
        await fetchTaskDetail(props.taskId);
      }
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

const fetchTaskDetail = async (id: string) => {
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
    editColor.value = fetchedTask.color || null;
    lastMatchedKeyword.value = null;
    lastMatchedPriority.value = null;
    lastExtractedTags.value = [];
  } catch (err: any) {
    error.value = t('errors.loadTask', { message: err.message || err });
  } finally {
    loading.value = false;
  }
};

// Watch for date keywords, hashtags, and bucket routing in the title in real-time while editing
watch(editTitle, (newTitle) => {
  if (!isEditing.value) return;
  const bucketNames = props.buckets.map((b) => b.name);
  const result = parseTitleState(newTitle, locale.value, bucketNames);

  // 1. Due Date Sync
  if (result.matchedKeyword) {
    if (result.matchedKeyword !== lastMatchedKeyword.value) {
      editDueDate.value = result.dueDate || '';
      lastMatchedKeyword.value = result.matchedKeyword;
    }
  } else {
    lastMatchedKeyword.value = null;
  }

  // 2. Tags Sync
  const currentTags = result.tags;
  const lastTags = lastExtractedTags.value;
  const isTagsEqual = currentTags.length === lastTags.length && currentTags.every((t, idx) => t === lastTags[idx]);
  if (!isTagsEqual) {
    const inputTags = editTags.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const tagsToRemove = lastTags.filter((t) => !currentTags.includes(t));
    let updatedTags = inputTags.filter((t) => !tagsToRemove.includes(t));

    currentTags.forEach((t) => {
      if (!updatedTags.includes(t)) {
        updatedTags.push(t);
      }
    });

    editTags.value = updatedTags.join(', ');
    lastExtractedTags.value = [...currentTags];
  }

  // 3. Bucket/Column Sync
  if (result.bucket) {
    editBucket.value = result.bucket;
  }

  // 4. Priority Sync
  if (result.matchedPriority) {
    if (result.matchedPriority !== lastMatchedPriority.value) {
      editPriority.value = result.priority || '';
      lastMatchedPriority.value = result.matchedPriority;
    }
  } else {
    lastMatchedPriority.value = null;
  }
});

// Compile Markdown body safely
const parsedMarkdown = computed(() => {
  if (!task.value || !task.value.body) return '';
  try {
    let checkboxIndex = 0;
    const renderer = new marked.Renderer();
    renderer.checkbox = ({ checked }) => {
      const idx = checkboxIndex++;
      return `<input type="checkbox" data-checkbox-index="${idx}" ${checked ? 'checked' : ''} />`;
    };
    return marked.parse(task.value.body, { renderer });
  } catch {
    return task.value.body;
  }
});

const toggleCheckboxInBody = async (targetIndex: number, isChecked: boolean) => {
  if (!task.value) return;

  let currentIndex = 0;
  const regex = /(^|\n)(\s*[-*+]\s+\[)([ xX])(\])/g;

  const newBody = task.value.body.replace(regex, (match, p1, p2, _p3, p4) => {
    if (currentIndex === targetIndex) {
      currentIndex++;
      const newChar = isChecked ? 'x' : ' ';
      return p1 + p2 + newChar + p4;
    }
    currentIndex++;
    return match;
  });

  try {
    const updated = await updateTask(props.projectId, task.value.id, {
      body: newBody,
    });
    task.value = updated;
    emit('updated');
  } catch (err: any) {
    error.value = t('errors.updateTask', { message: err.message || err });
  }
};

const handleMarkdownClick = async (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
    const dataIndex = target.getAttribute('data-checkbox-index');
    if (dataIndex !== null) {
      const idx = parseInt(dataIndex, 10);
      const isChecked = (target as HTMLInputElement).checked;
      await toggleCheckboxInBody(idx, isChecked);
    }
  }
};

const handleSave = async () => {
  if (!task.value) return;

  const bucketNames = props.buckets.map((b) => b.name);
  const parseResult = parseTitleState(editTitle.value, locale.value, bucketNames);
  const finalTitle = parseResult.cleanTitle;

  if (!finalTitle) {
    error.value = t('errors.titleRequired');
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    // Process tags (split by comma and trim)
    const tagArray = editTags.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const updated = await updateTask(props.projectId, task.value.id, {
      title: finalTitle,
      bucket: editBucket.value,
      tags: tagArray,
      body: editBody.value,
      due_date: editDueDate.value,
      priority: editPriority.value,
      color: editColor.value,
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

const handleMarkDone = () => {
  if (task.value) {
    emit('mark-done', task.value);
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
    editColor.value = task.value.color || null;
    lastMatchedKeyword.value = null;
    lastMatchedPriority.value = null;
    lastExtractedTags.value = [];
  }
  isEditing.value = false;
  showAutocomplete.value = false;
  autocompleteIndex.value = 0;
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
        <button
          @click="emit('close')"
          class="text-slate-400 transition-colors p-1 rounded cursor-pointer"
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
                  @click="handleMarkdownClick"
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
                <div class="relative">
                  <input
                    ref="titleInput"
                    v-model="editTitle"
                    type="text"
                    class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                    :placeholder="t('form.titlePlaceholder')"
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
                        <span>{{ t('buckets.' + b.name) }}</span>
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
                    <option v-for="b in buckets" :key="b.name" :value="b.name">{{ t('buckets.' + b.name) }}</option>
                  </select>
                </div>
                <div class="relative">
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                    t('form.tagsLabel')
                  }}</label>
                  <input
                    v-model="editTags"
                    type="text"
                    @focus="isTagDropdownOpen = true"
                    @blur="isTagDropdownOpen = false"
                    class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                    :placeholder="t('form.tagsPlaceholderEdit')"
                  />
                  <div
                    v-if="isTagDropdownOpen && tagSuggestions.length"
                    class="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-theme-card border border-theme-border rounded shadow-xl z-30 p-1 space-y-0.5 scroller-thin"
                  >
                    <button
                      v-for="(suggestion, idx) in tagSuggestions"
                      :key="suggestion"
                      type="button"
                      @mousedown.prevent="selectTagSuggestion(suggestion)"
                      class="w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer font-medium"
                      :class="
                        idx === activeSuggestionIndex
                          ? 'bg-theme-column text-theme-text-main font-semibold'
                          : 'text-theme-text-card hover:bg-theme-column/80 hover:text-theme-text-main'
                      "
                    >
                      {{ suggestion }}
                    </button>
                  </div>
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
                v-if="task && task.bucket !== 'done'"
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
  </transition>
</template>

<style>
/* Style rendered markdown headers and checklists inside the modal */
.markdown-content h1 {
  font-size: 1.4rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
.markdown-content h2 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
.markdown-content h3 {
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
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
  cursor: pointer;
}
</style>
