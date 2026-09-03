import { ref, reactive, watch, computed, nextTick, provide, inject, type Ref, type InjectionKey } from 'vue';
import type { Task, Bucket } from '@/types';
import { parseTitleState, getKeywordMatches } from '@/utils/titleParser';
import { useTaskAutocomplete } from '@/composables/useTaskAutocomplete';

export interface TaskEditorForm {
  title: string;
  ignoredKeywords: Set<string>;
  bucket: string;
  tags: string;
  body: string;
  dueDate: string;
  plannedDate: string;
  priority: string;
  color: string | null;
  postponedUntil: string;
}

export interface UseTaskEditorOptions {
  task: Ref<Task | null>;
  buckets: Ref<Bucket[]>;
  locale: Ref<string>;
  patchTask: (task: Task, data: Partial<Task>) => Promise<Task>;
  titleInput: Ref<any>;
}

export function useTaskEditor({ task, buckets, locale, patchTask, titleInput }: UseTaskEditorOptions) {
  const isEditing = ref(false);

  const form = reactive<TaskEditorForm>({
    title: '',
    ignoredKeywords: new Set<string>(),
    bucket: 'todo',
    tags: '',
    body: '',
    dueDate: '',
    plannedDate: '',
    priority: '',
    color: null,
    postponedUntil: '',
  });

  const lastMatchedKeyword = ref<string | null>(null);
  const lastMatchedPriority = ref<string | null>(null);
  const lastExtractedTags = ref<string[]>([]);

  // Autocomplete State and Logic
  const titleRef = computed({
    get: () => form.title,
    set: (val) => {
      form.title = val;
    },
  });

  const { showAutocomplete, autocompleteIndex, filteredBuckets, checkAutocomplete, selectAutocompleteItem, handleTitleKeyDown } =
    useTaskAutocomplete(titleRef, titleInput);

  // Method to initialize/reset the edit state
  const initEditState = (taskVal: Task | null) => {
    if (taskVal) {
      form.title = taskVal.title;
      form.ignoredKeywords = new Set();
      form.bucket = taskVal.bucket;
      form.tags = taskVal.tags?.join(', ') || '';
      form.body = taskVal.body || '';
      form.dueDate = taskVal.due_date || '';
      form.plannedDate = taskVal.planned_date || '';
      form.priority = taskVal.priority || '';
      form.color = taskVal.color || null;
      form.postponedUntil = taskVal.postponed_until || '';
    } else {
      form.title = '';
      form.ignoredKeywords = new Set();
      form.bucket = 'todo';
      form.tags = '';
      form.body = '';
      form.dueDate = '';
      form.plannedDate = '';
      form.priority = '';
      form.color = null;
      form.postponedUntil = '';
    }
    lastMatchedKeyword.value = null;
    lastMatchedPriority.value = null;
    lastExtractedTags.value = [];
  };

  // Watch for date keywords, hashtags, and bucket routing in the title in real-time while editing
  watch(
    () => [form.title, form.ignoredKeywords] as const,
    ([newTitle, newIgnored]) => {
      if (!isEditing.value) return;
      const bucketNames = buckets.value.map((b) => b.name);
      const result = parseTitleState(newTitle, locale.value, bucketNames, newIgnored);

      // 1. Due & Planned Date Sync
      if (result.matchedKeyword) {
        if (result.matchedKeyword !== lastMatchedKeyword.value) {
          form.dueDate = result.dueDate || '';
          form.plannedDate = result.plannedDate || '';
          lastMatchedKeyword.value = result.matchedKeyword;
        }
      } else {
        if (lastMatchedKeyword.value) {
          form.dueDate = '';
          form.plannedDate = '';
        }
        lastMatchedKeyword.value = null;
      }

      // 2. Tags Sync
      const currentTags = result.tags;
      const lastTags = lastExtractedTags.value;
      const isTagsEqual = currentTags.length === lastTags.length && currentTags.every((t, idx) => t === lastTags[idx]);
      if (!isTagsEqual) {
        const inputTags = form.tags
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

        form.tags = updatedTags.join(', ');
        lastExtractedTags.value = [...currentTags];
      }

      // 3. Bucket/Column Sync
      if (result.bucket) {
        form.bucket = result.bucket;
      }

      // 4. Priority Sync
      if (result.matchedPriority) {
        if (result.matchedPriority !== lastMatchedPriority.value) {
          form.priority = result.priority || '';
          lastMatchedPriority.value = result.matchedPriority;
        }
      } else {
        if (lastMatchedPriority.value) {
          form.priority = '';
        }
        lastMatchedPriority.value = null;
      }
    }
  );

  // Automatically ignore keywords present in the title when starting to edit
  watch(isEditing, (newVal) => {
    if (newVal && task.value) {
      const bucketNames = buckets.value.map((b) => b.name);
      const matches = getKeywordMatches(task.value.title, locale.value, bucketNames, new Set());
      if (matches.length > 0) {
        const updated = new Set(form.ignoredKeywords);
        matches.forEach((m) => updated.add(m.keyword));
        form.ignoredKeywords = updated;
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
    const parseResult = parseTitleState(form.title, locale.value, bucketNames, form.ignoredKeywords);
    const finalTitle = parseResult.cleanTitle;

    if (!finalTitle) {
      if (onError) {
        onError(new Error('titleRequired'));
      }
      return;
    }

    try {
      const tagArray = form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const updated = await patchTask(task.value, {
        title: finalTitle,
        bucket: form.bucket,
        tags: tagArray,
        body: form.body,
        due_date: form.dueDate,
        planned_date: form.plannedDate,
        priority: form.priority,
        color: form.color,
        postponed_until: form.bucket === 'postponed' ? form.postponedUntil : '',
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

  const addChecklistItem = (getMarkdownEditorRef: Ref<any> | (() => any)) => {
    if (!isEditing.value) {
      initEditState(task.value);
      isEditing.value = true;
    }
    nextTick(() => {
      const editorComponent = typeof getMarkdownEditorRef === 'function' ? getMarkdownEditorRef() : getMarkdownEditorRef?.value;
      if (editorComponent?.appendTextAndFocus) {
        editorComponent.appendTextAndFocus('- [ ] ');
      } else {
        if (!form.body) {
          form.body = '- [ ] ';
        } else if (form.body.endsWith('\n')) {
          form.body += '- [ ] ';
        } else {
          form.body += '\n- [ ] ';
        }
        nextTick(() => {
          const ed = typeof getMarkdownEditorRef === 'function' ? getMarkdownEditorRef() : getMarkdownEditorRef?.value;
          ed?.focus?.();
        });
      }
    });
  };

  const hasChecklist = computed(() => {
    const bodyText = isEditing.value ? form.body : task.value?.body || '';
    return /(?:^|\n)\s*[-*+]\s+\[[ xX]\]/.test(bodyText);
  });

  return {
    form,
    isEditing,
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

export type TaskEditor = ReturnType<typeof useTaskEditor>;

export const TaskEditorKey: InjectionKey<TaskEditor> = Symbol('TaskEditor');

export function provideTaskEditor(editor: TaskEditor) {
  provide(TaskEditorKey, editor);
}

export function useTaskEditorContext(): TaskEditor {
  const context = inject(TaskEditorKey);
  if (!context) {
    throw new Error('useTaskEditorContext must be used within provideTaskEditor');
  }
  return context;
}
