<script lang="ts">
  import { marked } from 'marked';
  import type { Task, BucketName } from '@/types';
  import { getTask, updateTask, deleteTask } from '@/api';
  import { useI18n } from '@/composables/useI18n';
  import { useDialog } from '@/composables/useDialog';
  import { X, Slash } from '@lucide/svelte';
  import { parseTitleState } from '@/utils/dateParser';
  import { fade } from 'svelte/transition';
  import { onDestroy, tick } from 'svelte';

  let {
    isOpen,
    projectId,
    taskId,
    buckets = [],
    existingTags = [],
    onclose,
    onupdated,
    ondeleted,
    onmarkdone
  } = $props<{
    isOpen: boolean;
    projectId: string;
    taskId: string | null;
    buckets: { name: BucketName; title: string }[];
    existingTags?: string[];
    onclose?: () => void;
    onupdated?: () => void;
    ondeleted?: () => void;
    onmarkdone?: (task: Task) => void;
  }>();

  const { locale, t } = useI18n();
  const { showDialog } = useDialog();

  let task = $state<Task | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let isEditing = $state(false);

  // Edit state
  let editTitle = $state('');
  let editBucket = $state<string>('todo');
  let editTags = $state('');
  let editBody = $state('');
  let editDueDate = $state('');
  let editPriority = $state('');
  let editColor = $state<string | null>(null);

  const colors = [
    { id: 'red', name: 'Red', bg: 'bg-rose-500', ring: 'ring-rose-500' },
    { id: 'orange', name: 'Orange', bg: 'bg-amber-600', ring: 'ring-amber-600' },
    { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-500' },
    { id: 'green', name: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { id: 'blue', name: 'Blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
    { id: 'purple', name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
    { id: 'pink', name: 'Pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
  ];

  let lastMatchedKeyword: string | null = null;
  let lastMatchedPriority: string | null = null;
  let lastExtractedTags: string[] = [];

  let isTagDropdownOpen = $state(false);
  let titleInput = $state<HTMLInputElement | null>(null);
  let activeSuggestionIndex = $state(0);

  // Autocomplete State
  let showAutocomplete = $state(false);
  let autocompleteSearch = $state('');
  let autocompleteIndex = $state(0);

  const activeTagQuery = $derived.by(() => {
    const parts = editTags.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  });

  const currentTagsSet = $derived.by(() => {
    return new Set(
      editTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    );
  });

  const tagSuggestions = $derived.by(() => {
    const query = activeTagQuery;
    return existingTags.filter((tag) => {
      const normalizedTag = tag.toLowerCase();
      if (currentTagsSet.has(normalizedTag)) return false;
      return normalizedTag.includes(query);
    });
  });

  const filteredBuckets = $derived.by(() => {
    if (!showAutocomplete) return [];
    const searchVal = autocompleteSearch.toLowerCase();
    return buckets.filter(
      (b) =>
        b.name.toLowerCase().includes(searchVal) ||
        t('buckets.' + b.name)
          .toLowerCase()
          .includes(searchVal)
    );
  });

  const selectTagSuggestion = (suggestion: string) => {
    const parts = editTags.split(',');
    parts[parts.length - 1] = ' ' + suggestion;
    editTags = parts.join(',').trim() + ', ';
    isTagDropdownOpen = true;
  };

  const checkAutocomplete = () => {
    const input = titleInput;
    if (!input) {
      showAutocomplete = false;
      return;
    }

    const value = editTitle;
    const cursor = input.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursor);

    const match = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9\u00C0-\u017F_-]*)$/);
    if (match) {
      showAutocomplete = true;
      autocompleteSearch = match[1];
      if (autocompleteIndex >= filteredBuckets.length) {
        autocompleteIndex = 0;
      }
    } else {
      showAutocomplete = false;
    }
  };

  const selectAutocompleteItem = (bucketName: string) => {
    const input = titleInput;
    if (!input) return;

    const value = editTitle;
    const cursor = input.selectionStart || 0;
    const slashIndex = cursor - autocompleteSearch.length - 1;

    if (slashIndex >= 0) {
      editTitle = value.substring(0, slashIndex) + '/' + bucketName + ' ' + value.substring(cursor);
      const newCursor = slashIndex + bucketName.length + 2;
      tick().then(() => {
        input.setSelectionRange(newCursor, newCursor);
        input.focus();
        checkAutocomplete();
      });
    }
    showAutocomplete = false;
  };

  $effect(() => {
    tagSuggestions; // dependency
    activeSuggestionIndex = 0;
  });

  const handleTitleKeyDown = (event: KeyboardEvent) => {
    if (showAutocomplete && filteredBuckets.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        autocompleteIndex = (autocompleteIndex + 1) % filteredBuckets.length;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        autocompleteIndex = (autocompleteIndex - 1 + filteredBuckets.length) % filteredBuckets.length;
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        selectAutocompleteItem(filteredBuckets[autocompleteIndex].name);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        showAutocomplete = false;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isEditing && isTagDropdownOpen && tagSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % tagSuggestions.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + tagSuggestions.length) % tagSuggestions.length;
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        selectTagSuggestion(tagSuggestions[activeSuggestionIndex]);
        isTagDropdownOpen = false;
        return;
      }
    }

    if (event.key === 'Escape' || event.key === 'Esc') {
      onclose?.();
    } else if (event.ctrlKey && event.key === 'Enter') {
      if (isEditing) {
        event.preventDefault();
        handleSave();
      }
    }
  };

  const fetchTaskDetail = async (id: string) => {
    loading = true;
    error = null;
    try {
      const fetchedTask = await getTask(projectId, id);
      task = fetchedTask;
      editTitle = fetchedTask.title;
      editBucket = fetchedTask.bucket;
      editTags = fetchedTask.tags.join(', ');
      editBody = fetchedTask.body;
      editDueDate = fetchedTask.due_date || '';
      editPriority = fetchedTask.priority || '';
      editColor = fetchedTask.color || null;
      lastMatchedKeyword = null;
      lastMatchedPriority = null;
      lastExtractedTags = [];
    } catch (err: any) {
      error = t('errors.loadTask', { message: err.message || err });
    } finally {
      loading = false;
    }
  };

  $effect(() => {
    if (taskId !== null && isOpen) {
      fetchTaskDetail(taskId);
    } else {
      task = null;
      isEditing = false;
    }
  });

  $effect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  $effect(() => {
    if (!isEditing) return;
    const bucketNames = buckets.map((b) => b.name);
    const result = parseTitleState(editTitle, locale.value, bucketNames);

    if (result.matchedKeyword) {
      if (result.matchedKeyword !== lastMatchedKeyword) {
        editDueDate = result.dueDate || '';
        lastMatchedKeyword = result.matchedKeyword;
      }
    } else {
      lastMatchedKeyword = null;
    }

    const currentTags = result.tags;
    const lastTags = lastExtractedTags;
    const isTagsEqual = currentTags.length === lastTags.length && currentTags.every((t, idx) => t === lastTags[idx]);
    if (!isTagsEqual) {
      const inputTags = editTags
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

      editTags = updatedTags.join(', ');
      lastExtractedTags = [...currentTags];
    }

    if (result.bucket) {
      editBucket = result.bucket;
    }

    if (result.matchedPriority) {
      if (result.matchedPriority !== lastMatchedPriority) {
        editPriority = result.priority || '';
        lastMatchedPriority = result.matchedPriority;
      }
    } else {
      lastMatchedPriority = null;
    }
  });

  const parsedMarkdown = $derived.by(() => {
    if (!task || !task.body) return '';
    try {
      let checkboxIndex = 0;
      const renderer = new marked.Renderer();
      renderer.checkbox = ({ checked }) => {
        const idx = checkboxIndex++;
        return `<input type="checkbox" data-checkbox-index="${idx}" ${checked ? 'checked' : ''} />`;
      };
      return marked.parse(task.body, { renderer });
    } catch {
      return task.body;
    }
  });

  const toggleCheckboxInBody = async (targetIndex: number, isChecked: boolean) => {
    if (!task) return;

    let currentIndex = 0;
    const regex = /(^|\n)(\s*[-*+]\s+\[)([ xX])(\])/g;

    const newBody = task.body.replace(regex, (match, p1, p2, _p3, p4) => {
      if (currentIndex === targetIndex) {
        currentIndex++;
        const newChar = isChecked ? 'x' : ' ';
        return p1 + p2 + newChar + p4;
      }
      currentIndex++;
      return match;
    });

    try {
      const updated = await updateTask(projectId, task.id, {
        body: newBody,
      });
      task = updated;
      onupdated?.();
    } catch (err: any) {
      error = t('errors.updateTask', { message: err.message || err });
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

  const handleSave = async (e?: Event) => {
    if (e) e.preventDefault();
    if (!task) return;

    const bucketNames = buckets.map((b) => b.name);
    const parseResult = parseTitleState(editTitle, locale.value, bucketNames);
    const finalTitle = parseResult.cleanTitle;

    if (!finalTitle) {
      error = t('errors.titleRequired');
      return;
    }

    loading = true;
    error = null;
    try {
      const tagArray = editTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const updated = await updateTask(projectId, task.id, {
        title: finalTitle,
        bucket: editBucket,
        tags: tagArray,
        body: editBody,
        due_date: editDueDate,
        priority: editPriority,
        color: editColor,
      });

      task = updated;
      isEditing = false;
      onupdated?.();
    } catch (err: any) {
      error = t('errors.updateTask', { message: err.message || err });
    } finally {
      loading = false;
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    const confirmed = await showDialog({
      title: t('buttons.delete'),
      message: t('deleteConfirm'),
      type: 'warning',
      showCancel: true,
      confirmText: t('buttons.delete'),
      cancelText: t('buttons.cancel'),
    });
    if (!confirmed) return;

    loading = true;
    error = null;
    try {
      await deleteTask(projectId, task.id);
      ondeleted?.();
      onclose?.();
    } catch (err: any) {
      error = t('errors.deleteTask', { message: err.message || err });
      loading = false;
    }
  };

  const handleMarkDoneLocal = () => {
    if (task) {
      onmarkdone?.(task);
    }
  };

  const cancelEdit = () => {
    if (task) {
      editTitle = task.title;
      editBucket = task.bucket;
      editTags = task.tags.join(', ');
      editBody = task.body;
      editDueDate = task.due_date || '';
      editPriority = task.priority || '';
      editColor = task.color || null;
      lastMatchedKeyword = null;
      lastMatchedPriority = null;
      lastExtractedTags = [];
    }
    isEditing = false;
    showAutocomplete = false;
    autocompleteIndex = 0;
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

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" transition:fade={{ duration: 150 }}>
    <!-- Backdrop -->
    <button class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-default border-none w-full h-full" onclick={onclose}></button>

    <!-- Modal Content -->
    <div
      class="relative bg-theme-base border border-theme-border w-full max-w-3xl rounded shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-scale-up"
    >
      <button
        onclick={onclose}
        class="text-slate-400 transition-colors p-1 rounded cursor-pointer"
        style="position: absolute; top: 10px; right: 10px; z-index: 10;"
      >
        <X class="w-4 h-4 shrink-0" />
      </button>
      <!-- Error alert -->
      {#if error}
        <div class="mx-4 mt-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
          {error}
        </div>
      {/if}

      <!-- Main Body -->
      <div class="p-4 overflow-y-auto flex-grow scroller-thin">
        <!-- Loading State -->
        {#if loading && !task}
          <div class="flex flex-col items-center justify-center py-12 gap-3">
            <div class="w-8 h-8 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
            <span class="text-slate-400 text-xs">{t('loadingTask')}</span>
          </div>
        {:else if task}
          <div>
            <!-- View Mode -->
            {#if !isEditing}
              <div class="space-y-4">
                <div>
                  <h2 class="text-xl font-bold text-theme-text-main mb-1.5 leading-snug">
                    {task.title}
                  </h2>

                  <!-- Tags -->
                  {#if task.tags.length}
                    <div class="flex flex-wrap gap-1 mt-2">
                      {#each task.tags as tag (tag)}
                        <span
                          class="text-xs font-semibold px-2 py-0.5 bg-theme-card text-theme-text-card border border-theme-border rounded"
                        >
                          {tag}
                        </span>
                      {/each}
                    </div>
                  {/if}

                  <!-- Due Date & Priority Info -->
                  {#if task.due_date || task.priority}
                    <div class="flex flex-wrap gap-3.5 mt-3 items-center">
                      {#if task.due_date}
                        <div class="flex items-center gap-1.5 text-xs">
                          <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Due:</span>
                          <span class="bg-theme-card px-2 py-0.5 rounded border border-theme-border text-xs font-semibold text-theme-text-card">
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      {/if}
                      {#if task.priority}
                        <div class="flex items-center gap-1.5 text-xs">
                          <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Priority:</span>
                          <span
                            class="px-2 py-0.5 rounded border text-xs font-extrabold uppercase tracking-wider {getPriorityClasses(task.priority)}"
                          >
                            {t('priorityOptions.' + task.priority)}
                          </span>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="border-t border-theme-border pt-4">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-2">{t('notesLabel')}</h4>

                  <!-- Rendered Markdown -->
                  {#if task.body}
                    <div
                      class="markdown-content text-theme-text-card prose prose-invert max-w-none space-y-3 break-all"
                      onclick={handleMarkdownClick}
                    >
                      {@html parsedMarkdown}
                    </div>
                  {:else}
                    <div class="text-theme-text-muted italic text-xs py-2">{t('noDescription')}</div>
                  {/if}
                </div>

                <div class="text-xs text-theme-text-muted flex gap-4 border-t border-theme-border pt-3 font-mono">
                  <span>{t('timestampCreated', { date: new Date(task.created_at).toLocaleString() })}</span>
                  <span>{t('timestampUpdated', { date: new Date(task.updated_at).toLocaleString() })}</span>
                </div>
              </div>
            {:else}
              <!-- Edit Mode -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <div class="space-y-3">
                <!-- Title -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="editTaskTitle">{t('form.titleLabel')}</label>
                  <div class="relative">
                    <input
                      id="editTaskTitle"
                      bind:this={titleInput}
                      bind:value={editTitle}
                      type="text"
                      class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                      placeholder={t('form.titlePlaceholder')}
                      oninput={checkAutocomplete}
                      onclick={checkAutocomplete}
                      onkeyup={checkAutocomplete}
                      onkeydown={handleTitleKeyDown}
                      onblur={() => setTimeout(() => { showAutocomplete = false; }, 150)}
                    />
                    <!-- Autocomplete Popup -->
                    {#if showAutocomplete}
                      <div
                        class="absolute left-0 right-0 top-full mt-1 z-50 bg-theme-base border border-theme-border rounded shadow-xl max-h-48 overflow-y-auto py-1 scroller-thin"
                      >
                        {#each filteredBuckets as b, index (b.name)}
                          <!-- svelte-ignore a11y_interactive_supports_focus -->
                          <div
                            role="button"
                            onmousedown={() => selectAutocompleteItem(b.name)}
                            onmouseenter={() => autocompleteIndex = index}
                            class="px-3 py-1.5 text-sm flex items-center justify-between cursor-pointer transition-colors {
                              index === autocompleteIndex
                                ? 'bg-theme-primary text-white font-semibold'
                                : 'text-theme-text-main hover:bg-theme-card/60'
                            }"
                          >
                            <div class="flex items-center gap-2">
                              <span
                                class="w-1.5 h-1.5 rounded-full bg-theme-accent {index === autocompleteIndex ? 'bg-white' : ''}"
                              ></span>
                              <span>{t('buckets.' + b.name)}</span>
                            </div>
                            <span class="text-xs font-mono {index === autocompleteIndex ? 'text-white/80' : 'text-theme-text-muted'}"
                              >/{b.name}</span
                            >
                          </div>
                        {/each}
                        {#if filteredBuckets.length === 0}
                          <div class="px-3 py-2 text-xs text-theme-text-muted italic">
                            {t('form.noBucketsFound')}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Bucket & Tags Row -->
                <div class="grid grid-cols-2 gap-3.5">
                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="editTaskBucket">{t('form.columnLabel')}</label>
                    <select
                      id="editTaskBucket"
                      bind:value={editBucket}
                      class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                    >
                      {#each buckets as b (b.name)}
                        <option value={b.name}>{t('buckets.' + b.name)}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="relative">
                    <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="editTaskTags">{t('form.tagsLabel')}</label>
                    <input
                      id="editTaskTags"
                      bind:value={editTags}
                      type="text"
                      onfocus={() => isTagDropdownOpen = true}
                      onblur={() => setTimeout(() => { isTagDropdownOpen = false; }, 150)}
                      class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                      placeholder={t('form.tagsPlaceholderEdit')}
                    />
                    {#if isTagDropdownOpen && tagSuggestions.length}
                      <div
                        class="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-theme-card border border-theme-border rounded shadow-xl z-30 p-1 space-y-0.5 scroller-thin"
                      >
                        {#each tagSuggestions as suggestion, idx (suggestion)}
                          <button
                            type="button"
                            onmousedown={() => selectTagSuggestion(suggestion)}
                            class="w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer font-medium {
                              idx === activeSuggestionIndex
                                ? 'bg-theme-column text-theme-text-main font-semibold'
                                : 'text-theme-text-card hover:bg-theme-column/80 hover:text-theme-text-main'
                            }"
                          >
                            {suggestion}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Due Date & Priority Row -->
                <div class="grid grid-cols-2 gap-3.5">
                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="editTaskDueDate">{t('form.dueDateLabel')}</label>
                    <input
                      id="editTaskDueDate"
                      bind:value={editDueDate}
                      type="date"
                      class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="editTaskPriority">{t('form.priorityLabel')}</label>
                    <select
                      id="editTaskPriority"
                      bind:value={editPriority}
                      class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                    >
                      <option value="">{t('priorityOptions.none')}</option>
                      <option value="low">{t('priorityOptions.low')}</option>
                      <option value="medium">{t('priorityOptions.medium')}</option>
                      <option value="high">{t('priorityOptions.high')}</option>
                      <option value="urgent">{t('priorityOptions.urgent')}</option>
                    </select>
                  </div>
                </div>

                <!-- Highlight Color Selector -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="editColorSelect">
                    {t('columnEdit.colorLabel')}
                  </label>
                  <div id="editColorSelect" class="flex flex-wrap gap-2.5 items-center">
                    <!-- None Option -->
                    <button
                      type="button"
                      onclick={() => editColor = null}
                      class="w-7 h-7 rounded-full border border-theme-border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 text-theme-text-muted hover:text-theme-text-main {
                        editColor === null
                          ? 'ring-2 ring-theme-accent ring-offset-2 ring-offset-theme-base bg-theme-card/80 border-theme-accent/60'
                          : 'bg-theme-card/30 hover:bg-theme-card'
                      }"
                      title={t('columnEdit.colorNone')}
                    >
                      <Slash class="w-3 h-3 shrink-0 rotate-90" />
                    </button>

                    <!-- Colors -->
                    {#each colors as c (c.id)}
                      <button
                        type="button"
                        onclick={() => editColor = c.id}
                        class="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95 {c.bg} {editColor === c.id ? `ring-2 ring-offset-2 ring-offset-theme-base ${c.ring}` : ''}"
                        title={c.name}
                      ></button>
                    {/each}
                  </div>
                </div>

                <!-- Body (Markdown Textarea) -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="editTaskBody">
                    {t('form.markdownLabelEdit')}
                  </label>
                  <textarea
                    id="editTaskBody"
                    bind:value={editBody}
                    rows="10"
                    class="w-full bg-theme-base/60 border border-theme-border rounded p-3 text-sm text-theme-text-input font-mono focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring scroller-thin"
                    placeholder={t('form.markdownPlaceholderEdit')}
                  ></textarea>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer Buttons -->
      <div class="px-4 py-3 border-t border-theme-border flex justify-between items-center bg-theme-card/30 shrink-0">
        <div>
          {#if task && !isEditing}
            <button
              onclick={handleDelete}
              class="text-sm font-semibold px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors cursor-pointer"
            >
              {t('buttons.delete')}
            </button>
          {/if}
        </div>
        <div class="flex gap-2">
          <!-- View mode buttons -->
          {#if !isEditing}
            {#if task && task.bucket !== 'done'}
              <button
                onclick={handleMarkDoneLocal}
                class="text-sm font-semibold px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all cursor-pointer"
              >
                {t('buttons.markDone')}
              </button>
            {/if}
            <button
              onclick={() => isEditing = true}
              class="text-sm font-semibold px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25 rounded transition-all cursor-pointer"
            >
              {t('buttons.edit')}
            </button>
          {:else}
            <!-- Edit mode buttons -->
            <button
              onclick={cancelEdit}
              class="text-sm font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
              disabled={loading}
            >
              {t('buttons.cancel')}
            </button>
            <button
              onclick={handleSave}
              class="text-sm font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              disabled={loading}
            >
              {#if loading}
                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              {/if}
              {t('buttons.save')}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
/* Style rendered markdown headers and checklists inside the modal */
.markdown-content :global(h1) {
  font-size: 1.4rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
.markdown-content :global(h2) {
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
.markdown-content :global(h3) {
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
}
.markdown-content :global(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.markdown-content :global(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.markdown-content :global(li) {
  margin-bottom: 0.25rem;
}
.markdown-content :global(p) {
  margin-bottom: 0.75rem;
  line-height: 1.6;
}
.markdown-content :global(code) {
  background-color: var(--theme-bg-card);
  padding: 0.15rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
  color: var(--theme-accent);
}
.markdown-content :global(pre) {
  background-color: var(--theme-bg-base);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 0.75rem;
}
.markdown-content :global(pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
}
.markdown-content :global(a) {
  color: var(--theme-accent);
  text-decoration: underline;
}
.markdown-content :global(a:hover) {
  color: var(--theme-accent-hover);
}
.markdown-content :global(blockquote) {
  border-left: 3px solid var(--theme-border);
  padding-left: 0.75rem;
  color: #94a3b8;
  font-style: italic;
  margin: 0.75rem 0;
}
.markdown-content :global(input[type='checkbox']) {
  accent-color: var(--theme-primary);
  margin-right: 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
}
</style>
