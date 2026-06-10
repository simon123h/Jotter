<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useProjectStore } from '@/stores/project';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    suggestionsOverride?: string[];
    inputClass?: string;
    placement?: 'top' | 'bottom';
  }>(),
  {
    placeholder: '',
    suggestionsOverride: undefined,
    inputClass: '',
    placement: 'bottom',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'enter'): void;
}>();

const projectStore = useProjectStore();
const isDropdownOpen = ref(false);
const activeSuggestionIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

// Get all tags currently used in tasks across all projects
const existingTags = computed(() => {
  const tagsSet = new Set<string>();
  projectStore.tasks.forEach((t) => {
    if (t.tags) {
      t.tags.forEach((tag) => {
        if (tag.trim()) {
          tagsSet.add(tag.trim().toLowerCase());
        }
      });
    }
  });
  return Array.from(tagsSet).sort();
});

// The current query is the text after the last comma
const activeTagQuery = computed(() => {
  const parts = props.modelValue.split(',');
  return parts[parts.length - 1].trim().toLowerCase();
});

// Set of tags already added
const currentTagsSet = computed(() => {
  return new Set(
    props.modelValue
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );
});

// Suggestions list
const tagSuggestions = computed(() => {
  const query = activeTagQuery.value;
  const baseList = props.suggestionsOverride || existingTags.value;
  return baseList.filter((tag) => {
    const normalizedTag = tag.toLowerCase();
    if (currentTagsSet.value.has(normalizedTag)) return false;
    return normalizedTag.includes(query);
  });
});

// Reset active index when suggestions change
watch(tagSuggestions, () => {
  activeSuggestionIndex.value = 0;
});

const selectTagSuggestion = (suggestion: string) => {
  const parts = props.modelValue.split(',');
  parts[parts.length - 1] = ' ' + suggestion;
  const newVal = parts.join(',').trim() + ', ';
  emit('update:modelValue', newVal);
  isDropdownOpen.value = true;
  nextTick(() => {
    inputRef.value?.focus();
  });
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (isDropdownOpen.value && tagSuggestions.value.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % tagSuggestions.value.length;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      activeSuggestionIndex.value = (activeSuggestionIndex.value - 1 + tagSuggestions.value.length) % tagSuggestions.value.length;
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      selectTagSuggestion(tagSuggestions.value[activeSuggestionIndex.value]);
      isDropdownOpen.value = false;
      return;
    }
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      event.stopPropagation();
      isDropdownOpen.value = false;
      return;
    }
  }

  if (event.key === 'Enter') {
    emit('enter');
  }
};

const computedInputClasses = computed(() => {
  return (
    props.inputClass ||
    'w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring'
  );
});

const computedDropdownClasses = computed(() => {
  const baseClasses =
    'absolute left-0 right-0 max-h-40 overflow-y-auto bg-theme-card border border-theme-border rounded shadow-xl z-50 p-1 space-y-0.5 scroller-thin';
  const positionClass = props.placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1';
  return `${baseClasses} ${positionClass}`;
});
</script>

<template>
  <div class="relative w-full">
    <input
      ref="inputRef"
      type="text"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @focus="isDropdownOpen = true"
      @blur="isDropdownOpen = false"
      @keydown="handleKeyDown"
      :placeholder="placeholder"
      :class="computedInputClasses"
    />
    <div v-if="isDropdownOpen && tagSuggestions.length" :class="computedDropdownClasses">
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
</template>
