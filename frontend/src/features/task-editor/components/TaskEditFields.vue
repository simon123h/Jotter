<script setup lang="ts">
import { ref } from 'vue';
import { Slash, ClipboardList } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket } from '@/types';
import MarkdownEditor from '@/components/ui/MarkdownEditor.vue';
import KeywordHighlightInput from '@/components/ui/KeywordHighlightInput.vue';
import TagInput from '@/components/ui/TagInput.vue';
import { TASK_COLORS } from '@/utils/constants';

const { locale, t, tBucket } = useI18n();
const colors = TASK_COLORS;

const props = defineProps<{
  buckets: Bucket[];
  hasChecklist: boolean;
}>();

const title = defineModel<string>('title', { required: true });
const ignoredKeywords = defineModel<Set<string>>('ignoredKeywords', { default: () => new Set() });
const bucket = defineModel<string>('bucket', { required: true });
const tags = defineModel<string>('tags', { default: '' });
const postponedUntil = defineModel<string>('postponedUntil', { default: '' });
const dueDate = defineModel<string>('dueDate', { default: '' });
const plannedDate = defineModel<string>('plannedDate', { default: '' });
const priority = defineModel<string>('priority', { default: '' });
const color = defineModel<string | null>('color', { default: null });
const body = defineModel<string>('body', { default: '' });

const emit = defineEmits<{
  (e: 'add-checklist'): void;
}>();

const titleInputRef = ref<any>(null);
const markdownEditorRef = ref<any>(null);

// Autocomplete state for bucket shortcuts like /todo
const showAutocomplete = ref(false);
const autocompleteIndex = ref(0);

const checkAutocomplete = (e?: any) => {
  const target = titleInputRef.value?.inputRef || e?.target;
  if (!target) return;
  const val = target.value || '';
  const pos = target.selectionStart || 0;
  const beforeCursor = val.slice(0, pos);
  const match = beforeCursor.match(/\/(\w*)$/);

  if (match) {
    showAutocomplete.value = true;
    autocompleteIndex.value = 0;
  } else {
    showAutocomplete.value = false;
  }
};

const getFilteredBuckets = () => {
  const target = titleInputRef.value?.inputRef;
  const val = target?.value || title.value || '';
  const pos = target?.selectionStart || val.length;
  const match = val.slice(0, pos).match(/\/(\w*)$/);
  const query = match ? match[1].toLowerCase() : '';
  return props.buckets.filter((b) => b.name.toLowerCase().includes(query) || b.title.toLowerCase().includes(query));
};

const selectAutocompleteItem = (bucketName: string) => {
  bucket.value = bucketName;
  const target = titleInputRef.value?.inputRef;
  if (target) {
    const val = target.value;
    const pos = target.selectionStart || 0;
    const beforeCursor = val.slice(0, pos);
    const afterCursor = val.slice(pos);
    const match = beforeCursor.match(/\/(\w*)$/);
    if (match) {
      const newBefore = beforeCursor.slice(0, match.index) + '/' + bucketName + ' ';
      title.value = newBefore + afterCursor;
    }
  }
  showAutocomplete.value = false;
};

const handleTitleKeyDown = (e: KeyboardEvent) => {
  if (!showAutocomplete.value) return;
  const filtered = getFilteredBuckets();
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    autocompleteIndex.value = (autocompleteIndex.value + 1) % Math.max(1, filtered.length);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    autocompleteIndex.value = (autocompleteIndex.value - 1 + filtered.length) % Math.max(1, filtered.length);
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (filtered.length > 0 && filtered[autocompleteIndex.value]) {
      e.preventDefault();
      selectAutocompleteItem(filtered[autocompleteIndex.value].name);
    }
  } else if (e.key === 'Escape') {
    showAutocomplete.value = false;
  }
};

const focusTitle = () => {
  titleInputRef.value?.focus();
};

defineExpose({
  focusTitle,
  titleInputRef,
  markdownEditorRef,
});
</script>

<template>
  <div class="space-y-3">
    <!-- Title -->
    <div>
      <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.titleLabel') }}</label>
      <div class="relative">
        <KeywordHighlightInput
          ref="titleInputRef"
          v-model="title"
          v-model:ignored-keywords="ignoredKeywords"
          :bucket-names="buckets.map((b) => b.name)"
          :locale="locale"
          :placeholder="t('form.titlePlaceholder')"
          :required="true"
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
            v-for="(b, index) in getFilteredBuckets()"
            :key="b.name"
            @mousedown.prevent="selectAutocompleteItem(b.name)"
            @mouseenter="autocompleteIndex = index"
            class="px-3 py-1.5 text-sm flex items-center justify-between cursor-pointer transition-colors"
            :class="
              index === autocompleteIndex ? 'bg-theme-primary text-white font-semibold' : 'text-theme-text-main hover:bg-theme-card/60'
            "
          >
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-theme-accent" :class="index === autocompleteIndex ? 'bg-white' : ''"></span>
              <span>{{ tBucket(b.name, b.title) }}</span>
            </div>
            <span class="text-xs font-mono" :class="index === autocompleteIndex ? 'text-white/80' : 'text-theme-text-muted'"
              >/{{ b.name }}</span
            >
          </div>
          <div v-if="getFilteredBuckets().length === 0" class="px-3 py-2 text-xs text-theme-text-muted italic">
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
          <option v-for="b in buckets" :key="b.name" :value="b.name">{{ tBucket(b.name, b.title) }}</option>
        </select>
      </div>
      <div class="relative">
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.tagsLabel') }}</label>
        <TagInput v-model="tags" :placeholder="t('form.tagsPlaceholderEdit')" />
      </div>
    </div>

    <!-- Postponed Until Row (Only shown when bucket is set to postponed) -->
    <div v-if="bucket === 'postponed'">
      <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
        {{ t('form.postponedUntilLabel') || 'Postponed Until' }}
      </label>
      <input
        v-model="postponedUntil"
        type="date"
        class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
        required
      />
    </div>

    <!-- Due Date, Planned Date & Priority Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.dueDateLabel') }}</label>
        <input
          v-model="dueDate"
          type="date"
          class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
        />
      </div>
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
          t('form.plannedDateLabel') || 'Planned'
        }}</label>
        <select
          v-model="plannedDate"
          class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
        >
          <option value="">{{ t('plannedDateOptions.none') }}</option>
          <option value="today">{{ t('plannedDateOptions.today') }}</option>
          <option value="tomorrow">{{ t('plannedDateOptions.tomorrow') }}</option>
          <option value="thisWeek">{{ t('plannedDateOptions.thisWeek') }}</option>
          <option value="thisMonth">{{ t('plannedDateOptions.thisMonth') }}</option>
          <option value="thisYear">{{ t('plannedDateOptions.thisYear') }}</option>
          <option value="sometime">{{ t('plannedDateOptions.sometime') }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.priorityLabel') }}</label>
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

    <!-- Highlight Color Selector -->
    <div>
      <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
        {{ t('columnEdit.colorLabel') }}
      </label>
      <div class="flex flex-wrap gap-2.5 items-center">
        <!-- None Option -->
        <button
          type="button"
          @click="color = null"
          class="w-7 h-7 rounded-full border border-theme-border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 text-theme-text-muted hover:text-theme-text-main"
          :class="[
            color === null
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
          @click="color = c.id"
          class="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95"
          :class="[c.bg, color === c.id ? `ring-2 ring-offset-2 ring-offset-theme-base ${c.ring}` : '']"
          :title="c.name"
        />
      </div>
    </div>

    <!-- Body (Markdown Editor) -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted">
          {{ t('form.markdownLabelEdit') }}
        </label>
        <button
          v-if="!hasChecklist"
          type="button"
          @click="emit('add-checklist')"
          class="text-xs font-semibold px-2 py-1 bg-theme-column hover:bg-theme-column/80 text-theme-text-main border border-theme-border rounded flex items-center gap-1 transition-all cursor-pointer hover:border-theme-accent hover:text-theme-accent"
        >
          <ClipboardList class="w-3.5 h-3.5" />
          {{ t('form.quickAddChecklist') }}
        </button>
      </div>
      <MarkdownEditor ref="markdownEditorRef" v-model="body" :rows="12" :placeholder="t('form.markdownPlaceholderEdit')" />
    </div>
  </div>
</template>
