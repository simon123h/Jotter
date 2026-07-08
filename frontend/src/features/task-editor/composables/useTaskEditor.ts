import { ref, watch, computed, nextTick, type Ref } from 'vue';
import type { Task } from '@/types';
import { parseTitleState, getKeywordMatches } from '@/utils/titleParser';
import { useTaskAutocomplete } from '@/composables/useTaskAutocomplete';

export interface UseTaskEditorOptions {
  task: Ref<Task | null>;
  buckets: Ref<any[]>;
  locale: Ref<string>;
  patchTask: (task: Task, data: Partial<Task>) => Promise<Task>;
  titleInput: Ref<any>;
}

export function useTaskEditor({ task, buckets, locale, patchTask, titleInput }: UseTaskEditorOptions) {
  const isEditing = ref(false);

  // Edit state refs
  const editTitle = ref('');
  const ignoredKeywords = ref<Set<string>>(new Set());
  const editBucket = ref<string>('todo');
  const editTags = ref('');
  const editBody = ref('');
  const editDueDate = ref('');
  const editPlannedDate = ref('');
  const editPriority = ref('');
  const editColor = ref<string | null>(null);
  const editPostponedUntil = ref('');

  const lastMatchedKeyword = ref<string | null>(null);
  const lastMatchedPriority = ref<string | null>(null);
  const lastExtractedTags = ref<string[]>([]);

  // Autocomplete State and Logic
  const { showAutocomplete, autocompleteIndex, filteredBuckets, checkAutocomplete, selectAutocompleteItem, handleTitleKeyDown } =
    useTaskAutocomplete(editTitle, titleInput);

  // Method to initialize/reset the edit state
  const initEditState = (taskVal: Task | null) => {
    if (taskVal) {
      editTitle.value = taskVal.title;
      ignoredKeywords.value = new Set();
      editBucket.value = taskVal.bucket;
      editTags.value = taskVal.tags?.join(', ') || '';
      editBody.value = taskVal.body || '';
      editDueDate.value = taskVal.due_date || '';
      editPlannedDate.value = taskVal.planned_date || '';
      editPriority.value = taskVal.priority || '';
      editColor.value = taskVal.color || null;
      editPostponedUntil.value = taskVal.postponed_until || '';
    } else {
      editTitle.value = '';
      ignoredKeywords.value = new Set();
      editBucket.value = 'todo';
      editTags.value = '';
      editBody.value = '';
      editDueDate.value = '';
      editPlannedDate.value = '';
      editPriority.value = '';
      editColor.value = null;
      editPostponedUntil.value = '';
    }
    lastMatchedKeyword.value = null;
    lastMatchedPriority.value = null;
    lastExtractedTags.value = [];
  };

  // Watch for date keywords, hashtags, and bucket routing in the title in real-time while editing
  watch([editTitle, ignoredKeywords], ([newTitle, newIgnored]) => {
    if (!isEditing.value) return;
    const bucketNames = buckets.value.map((b) => b.name);
    const result = parseTitleState(newTitle, locale.value, bucketNames, newIgnored);

    // 1. Due & Planned Date Sync
    if (result.matchedKeyword) {
      if (result.matchedKeyword !== lastMatchedKeyword.value) {
        editDueDate.value = result.dueDate || '';
        editPlannedDate.value = result.plannedDate || '';
        lastMatchedKeyword.value = result.matchedKeyword;
      }
    } else {
      if (lastMatchedKeyword.value) {
        editDueDate.value = '';
        editPlannedDate.value = '';
      }
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
      const updatedTags = inputTags.filter((t) => !tagsToRemove.includes(t));

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
      if (lastMatchedPriority.value) {
        editPriority.value = '';
      }
      lastMatchedPriority.value = null;
    }
  });

  // Automatically ignore keywords present in the title when starting to edit
  watch(isEditing, (newVal) => {
    if (newVal && task.value) {
      const bucketNames = buckets.value.map((b) => b.name);
      const matches = getKeywordMatches(task.value.title, locale.value, bucketNames, new Set());
      if (matches.length > 0) {
        const updated = new Set(ignoredKeywords.value);
        matches.forEach((m) => updated.add(m.keyword));
        ignoredKeywords.value = updated;
      }
    }
  });

  // Watch for external task changes to update the form fields
  watch(
    task,
    (newTask) => {
      if (!isEditing.value) {
        initEditState(newTask);
      }
    },
    { immediate: true }
  );

  const cancelEdit = () => {
    initEditState(task.value);
    isEditing.value = false;
    showAutocomplete.value = false;
    autocompleteIndex.value = 0;
  };

  const handleSave = async (onSuccess?: (updated: Task) => void, onError?: (err: any) => void) => {
    if (!task.value) return;

    const bucketNames = buckets.value.map((b) => b.name);
    const parseResult = parseTitleState(editTitle.value, locale.value, bucketNames, ignoredKeywords.value);
    const finalTitle = parseResult.cleanTitle;

    if (!finalTitle) {
      if (onError) {
        onError(new Error('titleRequired'));
      }
      return;
    }

    try {
      const tagArray = editTags.value
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const updated = await patchTask(task.value, {
        title: finalTitle,
        bucket: editBucket.value,
        tags: tagArray,
        body: editBody.value,
        due_date: editDueDate.value,
        planned_date: editPlannedDate.value,
        priority: editPriority.value,
        color: editColor.value,
        postponed_until: editBucket.value === 'postponed' ? editPostponedUntil.value : '',
      });

      isEditing.value = false;
      if (onSuccess) {
        onSuccess(updated);
      }
    } catch (err: any) {
      if (onError) {
        onError(err);
      }
    }
  };

  const addChecklistItem = (markdownEditorRef: Ref<any>) => {
    if (!isEditing.value) {
      isEditing.value = true;
    }
    nextTick(() => {
      markdownEditorRef.value?.appendTextAndFocus('- [ ] ');
    });
  };

  const hasChecklist = computed(() => {
    const bodyText = isEditing.value ? editBody.value : task.value?.body || '';
    return /(?:^|\n)\s*[-*+]\s+\[[ xX]\]/.test(bodyText);
  });

  return {
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
    editPostponedUntil,
    showAutocomplete,
    autocompleteIndex,
    filteredBuckets,
    checkAutocomplete,
    selectAutocompleteItem,
    handleTitleKeyDown,
    initEditState,
    cancelEdit,
    handleSave,
    addChecklistItem,
    hasChecklist,
  };
}
