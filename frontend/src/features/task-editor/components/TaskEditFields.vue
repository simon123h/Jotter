<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import { Slash, ClipboardList } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket } from '@/types';
import { useTaskEditorContext } from '../composables/useTaskEditor';
import KeywordHighlightInput from '@/components/ui/KeywordHighlightInput.vue';
import TagInput from '@/components/ui/TagInput.vue';
import { TASK_COLORS } from '@/utils/constants';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/ui/MarkdownEditor.vue'));

const { locale, t, tBucket } = useI18n();
const colors = TASK_COLORS;

defineProps<{
  buckets: Bucket[];
}>();

const emit = defineEmits<{
  (e: 'add-checklist'): void;
}>();

const editor = useTaskEditorContext();

const titleInputRef = ref<any>(null);
const markdownEditorRef = ref<any>(null);

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
          v-model="editor.form.title"
          v-model:ignored-keywords="editor.form.ignoredKeywords"
          :bucket-names="buckets.map((b) => b.name)"
          :locale="locale"
          :placeholder="t('form.titlePlaceholder')"
          :required="true"
          @input="editor.checkAutocomplete"
          @click="editor.checkAutocomplete"
          @keyup="editor.checkAutocomplete"
          @keydown="editor.handleTitleKeyDown"
          @blur="editor.showAutocomplete.value = false"
        />
        <!-- Autocomplete Popup -->
        <div
          v-if="editor.showAutocomplete.value"
          class="absolute left-0 right-0 top-full mt-1 z-50 bg-theme-base border border-theme-border rounded shadow-xl max-h-48 overflow-y-auto py-1 scroller-thin"
        >
          <div
            v-for="(b, index) in editor.filteredBuckets.value"
            :key="b.name"
            @mousedown.prevent="editor.selectAutocompleteItem(b.name)"
            @mouseenter="editor.autocompleteIndex.value = index"
            class="px-3 py-1.5 text-sm flex items-center justify-between cursor-pointer transition-colors"
            :class="
              index === editor.autocompleteIndex.value
                ? 'bg-theme-primary text-white font-semibold'
                : 'text-theme-text-main hover:bg-theme-card/60'
            "
          >
            <div class="flex items-center gap-2">
              <span
                class="w-1.5 h-1.5 rounded-full bg-theme-accent"
                :class="index === editor.autocompleteIndex.value ? 'bg-white' : ''"
              ></span>
              <span>{{ tBucket(b.name, b.title) }}</span>
            </div>
            <span class="text-xs font-mono" :class="index === editor.autocompleteIndex.value ? 'text-white/80' : 'text-theme-text-muted'"
              >/{{ b.name }}</span
            >
          </div>
          <div v-if="editor.filteredBuckets.value.length === 0" class="px-3 py-2 text-xs text-theme-text-muted italic">
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
          v-model="editor.form.bucket"
          class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
        >
          <option v-for="b in buckets" :key="b.name" :value="b.name">{{ tBucket(b.name, b.title) }}</option>
        </select>
      </div>
      <div class="relative">
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.tagsLabel') }}</label>
        <TagInput v-model="editor.form.tags" :placeholder="t('form.tagsPlaceholderEdit')" />
      </div>
    </div>

    <!-- Postponed Until Row (Only shown when bucket is set to postponed) -->
    <div v-if="editor.form.bucket === 'postponed'">
      <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
        {{ t('form.postponedUntilLabel') || 'Postponed Until' }}
      </label>
      <input
        v-model="editor.form.postponedUntil"
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
          v-model="editor.form.dueDate"
          type="date"
          class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
        />
      </div>
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
          t('form.plannedDateLabel') || 'Planned'
        }}</label>
        <select
          v-model="editor.form.plannedDate"
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
          v-model="editor.form.priority"
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
          @click="editor.form.color = null"
          class="w-7 h-7 rounded-full border border-theme-border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 text-theme-text-muted hover:text-theme-text-main"
          :class="[
            editor.form.color === null
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
          @click="editor.form.color = c.id"
          class="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95"
          :class="[c.bg, editor.form.color === c.id ? `ring-2 ring-offset-2 ring-offset-theme-base ${c.ring}` : '']"
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
          v-if="!editor.hasChecklist.value"
          type="button"
          @click="emit('add-checklist')"
          class="text-xs font-semibold px-2 py-1 bg-theme-column hover:bg-theme-column/80 text-theme-text-main border border-theme-border rounded flex items-center gap-1 transition-all cursor-pointer hover:border-theme-accent hover:text-theme-accent"
        >
          <ClipboardList class="w-3.5 h-3.5" />
          {{ t('form.quickAddChecklist') }}
        </button>
      </div>
      <MarkdownEditor ref="markdownEditorRef" v-model="editor.form.body" :rows="12" :placeholder="t('form.markdownPlaceholderEdit')" />
    </div>
  </div>
</template>
