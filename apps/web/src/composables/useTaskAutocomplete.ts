import { ref, computed, nextTick, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from '@/composables/useI18n';
import { useProjectStore } from '@/stores/project';

/**
 * Headless composable for task slash-autocomplete logic.
 * Detects '/bucket' cursor navigation and handles dropdown state and keyboard selection.
 *
 * @param titleRef - A Vue Ref pointing to the text input's current string value
 * @param titleInputRef - A Vue Ref pointing to the input component or HTMLInputElement
 */
export function useTaskAutocomplete(titleRef: Ref<string>, titleInputRef: Ref<any>) {
  const { tBucket } = useI18n();
  const projectStore = useProjectStore();
  const { buckets } = storeToRefs(projectStore);

  const showAutocomplete = ref(false);
  const autocompleteSearch = ref('');
  const autocompleteIndex = ref(0);

  const filteredBuckets = computed(() => {
    if (!showAutocomplete.value) return [];
    const search = autocompleteSearch.value.toLowerCase();
    return buckets.value.filter((b) => b.name.toLowerCase().includes(search) || tBucket(b.name, b.title).toLowerCase().includes(search));
  });

  const checkAutocomplete = () => {
    const input = titleInputRef.value ? titleInputRef.value.inputEl || titleInputRef.value : null;
    if (!input) {
      showAutocomplete.value = false;
      return;
    }

    const value = titleRef.value;
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
    const input = titleInputRef.value ? titleInputRef.value.inputEl || titleInputRef.value : null;
    if (!input) return;

    const value = titleRef.value;
    const cursor = input.selectionStart || 0;
    const slashIndex = cursor - autocompleteSearch.value.length - 1;

    if (slashIndex >= 0) {
      titleRef.value = value.substring(0, slashIndex) + '/' + bucketName + ' ' + value.substring(cursor);
      const newCursor = slashIndex + bucketName.length + 2;
      nextTick(() => {
        if (titleInputRef.value?.setSelectionRange) {
          titleInputRef.value.setSelectionRange(newCursor, newCursor);
        } else {
          input.setSelectionRange(newCursor, newCursor);
        }
        titleInputRef.value?.focus();
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

  return {
    showAutocomplete,
    autocompleteSearch,
    autocompleteIndex,
    filteredBuckets,
    checkAutocomplete,
    selectAutocompleteItem,
    handleTitleKeyDown,
  };
}
