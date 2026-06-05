<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { BucketName } from '@/types';
  import { createTask } from '@/api';
  import { useI18n } from '@/composables/useI18n';
  import { parseTitleState } from '@/utils/dateParser';
  import { fade } from 'svelte/transition';
  import { onDestroy, tick } from 'svelte';

  let {
    isOpen,
    projectId,
    defaultBucket,
    buckets = [],
    existingTags = [],
    onclose,
    oncreated
  } = $props<{
    isOpen: boolean;
    projectId: string;
    defaultBucket: BucketName;
    buckets: { name: BucketName; title: string }[];
    existingTags?: string[];
    onclose?: () => void;
    oncreated?: () => void;
  }>();

  const { locale, t } = useI18n();

  let title = $state('');
  let bucket = $state<BucketName>('todo');
  let tags = $state('');
  let body = $state('');
  let dueDate = $state('');
  let priority = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);

  let titleInput = $state<HTMLInputElement | null>(null);
  let isTagDropdownOpen = $state(false);
  let activeSuggestionIndex = $state(0);

  let lastMatchedKeyword: string | null = null;
  let lastMatchedPriority: string | null = null;
  let lastExtractedTags: string[] = [];

  // Autocomplete State
  let showAutocomplete = $state(false);
  let autocompleteSearch = $state('');
  let autocompleteIndex = $state(0);

  const bucketTitle = (bucketName: string, bTitle: string) => {
    const translated = t('buckets.' + bucketName);
    return translated !== 'buckets.' + bucketName ? translated : bTitle;
  };

  const activeTagQuery = $derived.by(() => {
    const parts = tags.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  });

  const currentTagsSet = $derived.by(() => {
    return new Set(
      tags
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
    const parts = tags.split(',');
    parts[parts.length - 1] = ' ' + suggestion;
    tags = parts.join(',').trim() + ', ';
    isTagDropdownOpen = true;
  };

  $effect(() => {
    tagSuggestions; // establish dependency
    activeSuggestionIndex = 0;
  });

  const checkAutocomplete = () => {
    const input = titleInput;
    if (!input) {
      showAutocomplete = false;
      return;
    }

    const value = title;
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

    const value = title;
    const cursor = input.selectionStart || 0;
    const slashIndex = cursor - autocompleteSearch.length - 1;

    if (slashIndex >= 0) {
      title = value.substring(0, slashIndex) + '/' + bucketName + ' ' + value.substring(cursor);
      const newCursor = slashIndex + bucketName.length + 2;
      tick().then(() => {
        input.setSelectionRange(newCursor, newCursor);
        input.focus();
        checkAutocomplete();
      });
    }
    showAutocomplete = false;
  };

  const handleSubmit = async (e?: Event) => {
    if (e) e.preventDefault();
    if (loading) return;

    const bucketNames = buckets.map((b) => b.name);
    const parseResult = parseTitleState(title, locale.value, bucketNames);
    const finalTitle = parseResult.cleanTitle;

    if (!finalTitle) {
      error = t('errors.titleRequired');
      return;
    }

    loading = true;
    error = null;
    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      await createTask(projectId, {
        title: finalTitle,
        bucket,
        tags: tagArray,
        body,
        due_date: dueDate || undefined,
        priority: priority || undefined,
      });

      oncreated?.();
      onclose?.();
    } catch (err: any) {
      error = t('errors.createTask', { message: err.message || err });
    } finally {
      loading = false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isTagDropdownOpen && tagSuggestions.length > 0) {
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
      event.preventDefault();
      handleSubmit();
    }
  };

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

  $effect(() => {
    if (isOpen) {
      title = '';
      bucket = defaultBucket;
      tags = '';
      body = '';
      dueDate = '';
      priority = '';
      error = null;
      lastMatchedKeyword = null;
      lastMatchedPriority = null;
      lastExtractedTags = [];
      showAutocomplete = false;
      autocompleteIndex = 0;

      window.addEventListener('keydown', handleKeyDown);

      setTimeout(() => {
        titleInput?.focus();
      }, 50);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  $effect(() => {
    const bucketNames = buckets.map((b) => b.name);
    const result = parseTitleState(title, locale.value, bucketNames);

    if (result.matchedKeyword) {
      if (result.matchedKeyword !== lastMatchedKeyword) {
        dueDate = result.dueDate || '';
        lastMatchedKeyword = result.matchedKeyword;
      }
    } else {
      lastMatchedKeyword = null;
    }

    const currentTags = result.tags;
    const lastTags = lastExtractedTags;
    const isTagsEqual = currentTags.length === lastTags.length && currentTags.every((t, idx) => t === lastTags[idx]);
    if (!isTagsEqual) {
      const inputTags = tags
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

      tags = updatedTags.join(', ');
      lastExtractedTags = [...currentTags];
    }

    if (result.bucket) {
      bucket = result.bucket as BucketName;
    }

    if (result.matchedPriority) {
      if (result.matchedPriority !== lastMatchedPriority) {
        priority = result.priority || '';
        lastMatchedPriority = result.matchedPriority;
      }
    } else {
      lastMatchedPriority = null;
    }
  });
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" transition:fade={{ duration: 150 }}>
    <!-- Backdrop -->
    <button class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-default border-none w-full h-full" onclick={onclose}></button>

    <!-- Modal Content -->
    <div
      class="relative bg-theme-base border border-theme-border w-full max-w-2xl rounded shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-scale-up"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
        <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{t('createModalTitle')}</h3>
        <button
          onclick={onclose}
          class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
        >
          <X class="w-4 h-4 shrink-0" />
        </button>
      </div>

      <!-- Error Alert -->
      {#if error}
        <div class="mx-4 mt-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
          {error}
        </div>
      {/if}

      <!-- Form Body -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <form onsubmit={handleSubmit} class="p-4 overflow-y-auto flex-grow space-y-3.5 scroller-thin">
        <!-- Title -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="taskTitle">{t('form.titleLabel')}</label>
          <div class="relative">
            <input
              id="taskTitle"
              bind:this={titleInput}
              bind:value={title}
              type="text"
              required
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
                      <span class="w-1.5 h-1.5 rounded-full bg-theme-accent {index === autocompleteIndex ? 'bg-white' : ''}"></span>
                      <span>{bucketTitle(b.name, b.title)}</span>
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
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="taskBucket">{t('form.columnLabel')}</label>
            <select
              id="taskBucket"
              bind:value={bucket}
              class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            >
              {#each buckets as b (b.name)}
                <option value={b.name}>{bucketTitle(b.name, b.title)}</option>
              {/each}
            </select>
          </div>
          <div class="relative">
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="taskTags">{t('form.tagsLabel')}</label>
            <input
              id="taskTags"
              bind:value={tags}
              type="text"
              onfocus={() => isTagDropdownOpen = true}
              onblur={() => setTimeout(() => { isTagDropdownOpen = false; }, 150)}
              class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              placeholder={t('form.tagsPlaceholder')}
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
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="taskDueDate">{t('form.dueDateLabel')}</label>
            <input
              id="taskDueDate"
              bind:value={dueDate}
              type="date"
              class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="taskPriority">{t('form.priorityLabel')}</label>
            <select
              id="taskPriority"
              bind:value={priority}
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

        <!-- Body (Markdown Textarea) -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1" for="taskBody">
            {t('form.markdownLabel')}
          </label>
          <textarea
            id="taskBody"
            bind:value={body}
            rows="8"
            class="w-full bg-theme-base/60 border border-theme-border rounded p-3 text-sm text-theme-text-input font-mono focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring scroller-thin"
            placeholder={t('form.markdownPlaceholder')}
          ></textarea>
        </div>
      </form>

      <!-- Footer Buttons -->
      <div class="px-4 py-3 border-t border-theme-border flex justify-end gap-2 bg-theme-card/30 shrink-0">
        <button
          type="button"
          onclick={onclose}
          class="text-sm font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
          disabled={loading}
        >
          {t('buttons.cancel')}
        </button>
        <button
          type="button"
          onclick={handleSubmit}
          class="text-sm font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          disabled={loading}
        >
          {#if loading}
            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          {/if}
          {t('buttons.create')}
        </button>
      </div>
    </div>
  </div>
{/if}
