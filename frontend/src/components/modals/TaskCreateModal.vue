<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { X } from '@lucide/vue';
import type { BucketName } from '@/types';
import { createTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useProjectStore } from '@/stores/project';
import { parseTitleState } from '@/utils/dateParser';

const { locale, t } = useI18n();
const projectStore = useProjectStore();
const { activeProjectId, buckets, tasks } = storeToRefs(projectStore);

const props = defineProps<{
  isOpen: boolean;
  defaultBucket?: BucketName;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const title = ref('');
const bucket = ref<BucketName>(props.defaultBucket || 'todo');
const tags = ref('');
const body = ref('');
const dueDate = ref('');
const priority = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const titleInput = ref<HTMLInputElement | null>(null);

const existingTags = computed(() => {
  const tagsSet = new Set<string>();
  tasks.value.forEach((t) => {
    if (t.tags) {
      t.tags.forEach((tag) => tagsSet.add(tag.toLowerCase()));
    }
  });
  return Array.from(tagsSet).sort();
});

/** Translate the bucket name, if possible */
const bucketTitle = (bucketName: string, bucketTitle: string) => {
  const translated = t('buckets.' + bucketName);
  return translated !== 'buckets.' + bucketName ? translated : bucketTitle;
};

const isTagDropdownOpen = ref(false);

const activeTagQuery = computed(() => {
  const parts = tags.value.split(',');
  return parts[parts.length - 1].trim().toLowerCase();
});

const currentTagsSet = computed(() => {
  return new Set(
    tags.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );
});

const tagSuggestions = computed(() => {
  const query = activeTagQuery.value;
  return existingTags.value.filter((tag) => {
    const normalizedTag = tag.toLowerCase();
    if (currentTagsSet.value.has(normalizedTag)) return false;
    return normalizedTag.includes(query);
  });
});

const selectTagSuggestion = (suggestion: string) => {
  const parts = tags.value.split(',');
  parts[parts.length - 1] = ' ' + suggestion;
  tags.value = parts.join(',').trim() + ', ';
  isTagDropdownOpen.value = true;
};

const activeSuggestionIndex = ref(0);

// Reset active index when suggestions change
watch(tagSuggestions, () => {
  activeSuggestionIndex.value = 0;
});

const handleKeyDown = (event: KeyboardEvent) => {
  // If dropdown is open and has suggestions, handle keyboard navigation
  if (isTagDropdownOpen.value && tagSuggestions.value.length > 0) {
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
    event.preventDefault();
    handleSubmit();
  }
};

const lastMatchedKeyword = ref<string | null>(null);
const lastMatchedPriority = ref<string | null>(null);
const lastExtractedTags = ref<string[]>([]);

// Autocomplete State
const showAutocomplete = ref(false);
const autocompleteSearch = ref('');
const autocompleteIndex = ref(0);

const filteredBuckets = computed(() => {
  if (!showAutocomplete.value) return [];
  const search = autocompleteSearch.value.toLowerCase();
  return buckets.value.filter(
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

  const value = title.value;
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

  const value = title.value;
  const cursor = input.selectionStart || 0;
  const slashIndex = cursor - autocompleteSearch.value.length - 1;

  if (slashIndex >= 0) {
    title.value = value.substring(0, slashIndex) + '/' + bucketName + ' ' + value.substring(cursor);
    const newCursor = slashIndex + bucketName.length + 2;
    nextTick(() => {
      input.setSelectionRange(newCursor, newCursor);
      input.focus();
      checkAutocomplete();
    });
  }
  showAutocomplete.value = false;
};

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

// Reset form when modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      title.value = '';
      bucket.value = props.defaultBucket || 'todo';
      tags.value = '';
      body.value = '';
      dueDate.value = '';
      priority.value = '';
      error.value = null;
      lastMatchedKeyword.value = null;
      lastMatchedPriority.value = null;
      lastExtractedTags.value = [];
      showAutocomplete.value = false;
      autocompleteIndex.value = 0;

      window.addEventListener('keydown', handleKeyDown);

      nextTick(() => {
        titleInput.value?.focus();
      });
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// Watch for date keywords, hashtags, and bucket routing in the title in real-time
watch(title, (newTitle) => {
  const bucketNames = buckets.value.map((b) => b.name);
  const result = parseTitleState(newTitle, locale.value, bucketNames);

  // 1. Due Date Sync
  if (result.matchedKeyword) {
    if (result.matchedKeyword !== lastMatchedKeyword.value) {
      dueDate.value = result.dueDate || '';
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
    const inputTags = tags.value
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

    tags.value = updatedTags.join(', ');
    lastExtractedTags.value = [...currentTags];
  }

  // 3. Bucket/Column Sync
  if (result.bucket) {
    bucket.value = result.bucket as BucketName;
  }

  // 4. Priority Sync
  if (result.matchedPriority) {
    if (result.matchedPriority !== lastMatchedPriority.value) {
      priority.value = result.priority || '';
      lastMatchedPriority.value = result.matchedPriority;
    }
  } else {
    lastMatchedPriority.value = null;
  }
});

const handleSubmit = async () => {
  if (loading.value) return;

  const bucketNames = buckets.value.map((b) => b.name);
  const parseResult = parseTitleState(title.value, locale.value, bucketNames);
  const finalTitle = parseResult.cleanTitle;

  if (!finalTitle) {
    error.value = t('errors.titleRequired');
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const tagArray = tags.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    await createTask(activeProjectId.value, {
      title: finalTitle,
      bucket: bucket.value,
      tags: tagArray,
      body: body.value,
      due_date: dueDate.value || undefined,
      priority: priority.value || undefined,
    });

    projectStore.fetchTasks(activeProjectId.value, projectStore.activeProjectId === 'super-time' ? 'super-time' : 'board', false, false); 
    emit('close');
  } catch (err: any) {
    error.value = t('errors.createTask', { message: err.message || err });
  } finally {
    loading.value = false;
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
        class="relative bg-theme-base border border-theme-border w-full max-w-2xl rounded shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
      >
        <!-- Header -->
        <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
          <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{{ t('createModalTitle') }}</h3>
          <button
            @click="emit('close')"
            class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
          >
            <X class="w-4 h-4 shrink-0" />
          </button>
        </div>

        <!-- Error Alert -->
        <div v-if="error" class="mx-4 mt-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
          {{ error }}
        </div>

        <!-- Form Body -->
        <form @submit.prevent="handleSubmit" class="p-4 overflow-y-auto flex-grow space-y-3.5 scroller-thin">
          <!-- Title -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.titleLabel') }}</label>
            <div class="relative">
              <input
                ref="titleInput"
                v-model="title"
                type="text"
                required
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
                    <span class="w-1.5 h-1.5 rounded-full bg-theme-accent" :class="index === autocompleteIndex ? 'bg-white' : ''"></span>
                    <span>{{ bucketTitle(b.name, b.title) }}</span>
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
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.columnLabel') }}</label>
              <select
                v-model="bucket"
                class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              >
                <option v-for="b in buckets" :key="b.name" :value="b.name">{{ bucketTitle(b.name, b.title) }}</option>
              </select>
            </div>
            <div class="relative">
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.tagsLabel') }}</label>
              <input
                v-model="tags"
                type="text"
                @focus="isTagDropdownOpen = true"
                @blur="isTagDropdownOpen = false"
                class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
                :placeholder="t('form.tagsPlaceholder')"
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
                v-model="dueDate"
                type="date"
                class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
                t('form.priorityLabel')
              }}</label>
              <select
                v-model="priority"
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
              {{ t('form.markdownLabel') }}
            </label>
            <textarea
              v-model="body"
              rows="8"
              class="w-full bg-theme-base/60 border border-theme-border rounded p-3 text-sm text-theme-text-input font-mono focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring scroller-thin"
              :placeholder="t('form.markdownPlaceholder')"
            ></textarea>
          </div>
        </form>

        <!-- Footer Buttons -->
        <div class="px-4 py-3 border-t border-theme-border flex justify-end gap-2 bg-theme-card/30 shrink-0">
          <button
            type="button"
            @click="emit('close')"
            class="text-sm font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
            :disabled="loading"
          >
            {{ t('buttons.cancel') }}
          </button>
          <button
            type="submit"
            @click="handleSubmit"
            class="text-sm font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            :disabled="loading"
          >
            <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {{ t('buttons.create') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
