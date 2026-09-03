<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { marked } from 'marked';
import { X, Flame, Calendar, Clock, Check, Tag, CheckCircle, FolderInput, Trash2, ChevronLeft, ChevronRight } from '@lucide/vue';
import type { Task, Bucket } from '@/types';
import { useI18n } from '@/composables/useI18n';
import TagInput from '@/components/ui/TagInput.vue';
import { TRIAGE_COLORS, PRIORITY_OPTIONS } from '@/utils/constants';

const props = defineProps<{
  task: Task;
  buckets: Bucket[];
  currentTaskIndex: number;
  totalTasks: number;
}>();

const emit = defineEmits<{
  (e: 'update-task', payload: Partial<Task>): void;
  (e: 'mark-done'): void;
  (e: 'move-column'): void;
  (e: 'delete-task'): void;
  (e: 'next'): void;
  (e: 'prev'): void;
}>();

const { t, tBucket } = useI18n();

// Highlight card colors configuration
const colorsList = TRIAGE_COLORS;
const priorityList = PRIORITY_OPTIONS;

// Inline editing states
const isEditingTitle = ref(false);
const isEditingDescription = ref(false);
const editTitleText = ref('');
const editDescriptionText = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);
const descriptionInputRef = ref<HTMLTextAreaElement | null>(null);

// Tag adding state
const showTagInput = ref(false);
const newTagText = ref('');
const tagInputRef = ref<InstanceType<typeof TagInput> | null>(null);

// Watch task change to reset edit inputs
watch(
  () => props.task,
  (newTask) => {
    if (newTask) {
      editTitleText.value = newTask.title;
      editDescriptionText.value = newTask.body || '';
      isEditingTitle.value = false;
      isEditingDescription.value = false;
      showTagInput.value = false;
      newTagText.value = '';
    }
  },
  { immediate: true }
);

// Markdown compiler for task description
const compiledDescription = computed(() => {
  if (!props.task.body) return '';
  return marked.parse(props.task.body);
});

// Title edit save
const saveTitle = () => {
  const trimmed = editTitleText.value.trim();
  if (trimmed && props.task && trimmed !== props.task.title) {
    emit('update-task', { title: trimmed });
  }
  isEditingTitle.value = false;
};

// Description edit save
const saveDescription = () => {
  if (props.task && editDescriptionText.value !== props.task.body) {
    emit('update-task', { body: editDescriptionText.value });
  }
  isEditingDescription.value = false;
};

// Start edits
const startEditTitle = () => {
  isEditingTitle.value = true;
  setTimeout(() => titleInputRef.value?.focus(), 50);
};

const startEditDescription = () => {
  isEditingDescription.value = true;
  setTimeout(() => descriptionInputRef.value?.focus(), 50);
};

// Tag management
const startAddTag = () => {
  showTagInput.value = true;
  setTimeout(() => tagInputRef.value?.focus(), 50);
};

const saveTag = () => {
  const input = newTagText.value.trim();
  if (input && props.task) {
    const existing = props.task.tags || [];
    const newTags = input
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && !existing.includes(t));
    if (newTags.length > 0) {
      emit('update-task', { tags: [...existing, ...newTags] });
    }
  }
  newTagText.value = '';
  showTagInput.value = false;
};

const removeTag = (tag: string) => {
  if (!props.task) return;
  const existing = props.task.tags || [];
  emit('update-task', { tags: existing.filter((t) => t !== tag) });
};

// Expose methods for programmatic shortcut triggering
defineExpose({
  startEditTitle,
  startAddTag,
  isEditingTitle,
  isEditingDescription,
});
</script>

<template>
  <div
    class="max-w-2xl w-full flex flex-col h-[520px] rounded-2xl border bg-theme-card shadow-2xl transition-all duration-300 relative overflow-hidden animate-scale-in"
    :class="[
      colorsList.find((c) => c.id === task.color)?.bg || colorsList[0].bg,
      colorsList.find((c) => c.id === task.color)?.id ? 'border-l-[6px]' : 'border-theme-border/60',
    ]"
  >
    <!-- Task Header Metadata Bar -->
    <div class="px-6 py-4 flex items-center justify-between border-b border-theme-border/40 bg-theme-column/10 shrink-0">
      <!-- Priority Badge -->
      <div class="flex items-center gap-1.5">
        <span
          v-for="p in [priorityList.find((item) => item.id === task.priority) || priorityList[0]]"
          :key="p.id"
          class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 shadow-sm"
          :class="[p.color, p.bg, p.id === 'urgent' ? 'animate-pulse' : '']"
        >
          <Flame v-if="p.id === 'urgent' || p.id === 'high'" class="w-3 h-3 text-orange-400" />
          {{ t(p.label) }}
        </span>

        <!-- Column / Bucket Indicator -->
        <span
          class="px-2.5 py-1 rounded-full bg-theme-column border border-theme-border/40 text-theme-text-muted text-[10px] font-bold uppercase tracking-wider"
        >
          {{ tBucket(task.bucket, task.bucket) }}
        </span>
      </div>

      <!-- Planned Date Badge Indicator -->
      <div class="flex items-center gap-2">
        <span
          v-if="task.planned_date"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-theme-accent/10 border border-theme-accent/20 text-theme-accent shadow-sm"
        >
          <Clock class="w-3 h-3 text-theme-accent" />
          {{ t('plannedDateOptions.' + task.planned_date) }}
        </span>
        <span
          v-if="task.due_date"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400"
        >
          <Calendar class="w-3 h-3 text-red-400" />
          {{ t('taskDetail.dueLabel') }} {{ task.due_date }}
        </span>
      </div>
    </div>

    <!-- Central Editable Area -->
    <div class="flex-grow flex flex-col p-6 overflow-y-auto scroller-thin min-h-0">
      <!-- Editable Title -->
      <div class="mb-4">
        <div v-if="isEditingTitle" class="flex items-stretch gap-2">
          <input
            v-model="editTitleText"
            ref="titleInputRef"
            type="text"
            @blur="saveTitle"
            @keydown.enter="saveTitle"
            @keydown.esc="isEditingTitle = false"
            class="flex-grow bg-theme-base border border-theme-border rounded-lg px-3 py-1.5 text-sm font-bold text-theme-text-main focus:outline-none focus:ring-1 focus:ring-theme-primary"
          />
          <button @click="saveTitle" class="px-3 bg-theme-primary text-white rounded-lg text-xs font-bold cursor-pointer">
            <Check class="w-4 h-4" />
          </button>
        </div>
        <h1
          v-else
          @click="startEditTitle"
          class="text-xl font-extrabold text-theme-text-main tracking-tight cursor-pointer hover:underline decoration-dashed decoration-theme-primary/60 underline-offset-4 flex items-center justify-between group transition-all"
          :title="t('triage.clickOrEnterToEdit')"
        >
          <span>{{ task.title }}</span>
          <span
            class="text-[10px] font-semibold text-theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity bg-theme-column/60 border border-theme-border/40 rounded px-1.5 py-0.5"
          >
            {{ t('triage.clickToEdit') }}
          </span>
        </h1>
      </div>

      <!-- Tags Container -->
      <div class="flex flex-wrap items-center gap-1.5 mb-5 shrink-0">
        <Tag class="w-3.5 h-3.5 text-theme-text-muted mr-1 shrink-0" />
        <span
          v-for="tag in task.tags || []"
          :key="tag"
          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-theme-column/60 border border-theme-border/50 text-xs font-medium text-theme-text-muted"
        >
          #{{ tag }}
          <button
            @click.stop="removeTag(tag)"
            class="p-0.5 hover:bg-theme-base rounded text-theme-text-muted hover:text-rose-400 cursor-pointer"
            :title="t('triage.removeTag')"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </span>

        <!-- Inline Quick Tag Add Input -->
        <div v-if="showTagInput" class="flex items-center gap-1 w-44">
          <TagInput
            v-model="newTagText"
            ref="tagInputRef"
            @blur="saveTag"
            @enter="saveTag"
            @keydown.esc="showTagInput = false"
            :placeholder="t('triage.tagsPlaceholder')"
            input-class="bg-theme-base border border-theme-border rounded px-2 py-0.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary w-full"
          />
        </div>
        <button
          v-else
          @click="startAddTag"
          class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border border-dashed border-theme-border text-xs text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary/60 transition-colors cursor-pointer"
        >
          + {{ t('triage.addTags') }}
        </button>
      </div>

      <!-- Editable Description (Markdown Body) -->
      <div class="flex-grow flex flex-col min-h-0">
        <label class="text-[10px] font-extrabold uppercase tracking-widest text-theme-text-muted mb-1.5">
          {{ t('triage.description') }}
        </label>

        <div v-if="isEditingDescription" class="flex-grow flex flex-col gap-2 min-h-0">
          <textarea
            v-model="editDescriptionText"
            ref="descriptionInputRef"
            @keydown.ctrl.enter="saveDescription"
            @keydown.esc="isEditingDescription = false"
            @blur="saveDescription"
            :placeholder="t('triage.descriptionPlaceholder')"
            class="flex-grow w-full bg-theme-base border border-theme-border rounded-xl p-3 text-xs text-theme-text-main focus:outline-none focus:ring-1 focus:ring-theme-primary font-mono scroller-thin"
          ></textarea>
          <div class="flex justify-between items-center shrink-0">
            <span class="text-[10px] text-theme-text-muted font-semibold">{{ t('triage.pressToSave') }}</span>
            <div class="flex gap-1.5">
              <button
                @click="isEditingDescription = false"
                class="px-2.5 py-1 text-xs font-semibold text-theme-text-muted hover:text-theme-text-main cursor-pointer"
              >
                {{ t('buttons.cancel') }}
              </button>
              <button
                @click="saveDescription"
                class="px-3 py-1 bg-theme-primary hover:bg-theme-primary-hover text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shadow-lg"
              >
                <Check class="w-3.5 h-3.5" /> {{ t('buttons.save') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Rendered markdown display -->
        <div
          v-else
          @click="startEditDescription"
          class="flex-grow rounded-xl bg-theme-column/25 border border-theme-border/30 p-4 overflow-y-auto cursor-pointer hover:border-theme-border/70 transition-colors scroller-thin min-h-0 group relative"
          :title="t('triage.clickToEditMarkdown')"
        >
          <div
            v-if="task.body"
            class="prose prose-sm dark:prose-invert prose-p:leading-relaxed max-w-none text-xs text-theme-text-muted"
            v-html="compiledDescription"
          ></div>
          <div v-else class="text-xs text-theme-text-muted/40 font-semibold italic flex items-center gap-1">
            {{ t('triage.noDescription') }}
          </div>
          <span
            class="text-[9px] font-bold text-theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity bg-theme-card border border-theme-border/40 rounded px-1.5 py-0.5 absolute top-2 right-2 shadow-sm"
          >
            {{ t('triage.editBody') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Bottom Floating Queue Actions Bar -->
    <div class="px-6 py-4 border-t border-theme-border/40 bg-theme-column/10 flex items-center justify-between shrink-0">
      <!-- Left Side Actions (Complete, Delete, Move) -->
      <div class="flex items-center gap-1.5">
        <button
          @click="emit('mark-done')"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-emerald-500/10"
        >
          <CheckCircle class="w-4 h-4 shrink-0" />
          <span>{{ t('buttons.markDone') }}</span>
          <kbd class="hidden md:inline bg-white/25 text-white/95 text-[9px] px-1 py-0.5 rounded ml-0.5 font-bold font-mono">V</kbd>
        </button>

        <button
          @click="emit('move-column')"
          class="flex items-center gap-1 px-2.5 py-1.5 bg-theme-column hover:bg-theme-column/80 border border-theme-border/60 text-theme-text-muted hover:text-theme-text-main rounded-lg text-xs font-bold cursor-pointer transition-colors"
          :title="t('triage.moveToColumn')"
        >
          <FolderInput class="w-3.5 h-3.5 shrink-0" />
          <span class="hidden md:inline">{{ t('triage.moveColumn') }}</span>
          <kbd
            class="hidden md:inline bg-theme-card text-theme-text-muted text-[9px] px-1 py-0.5 rounded border border-theme-border ml-1 font-bold font-mono"
            >M</kbd
          >
        </button>

        <button
          @click="emit('delete-task')"
          class="p-2 bg-theme-column hover:bg-rose-500/15 border border-theme-border/60 hover:border-rose-500/35 text-theme-text-muted hover:text-rose-400 rounded-lg cursor-pointer transition-all"
          :title="t('buttons.deleteTask')"
        >
          <Trash2 class="w-4 h-4 shrink-0" />
        </button>
      </div>

      <!-- Queue Pager arrows (Prev / Next) -->
      <div class="flex items-center gap-1.5">
        <button
          @click="emit('prev')"
          :disabled="currentTaskIndex === 0"
          class="p-2 bg-theme-column hover:bg-theme-column/80 border border-theme-border/60 text-theme-text-muted disabled:opacity-40 hover:text-theme-text-main rounded-lg cursor-pointer transition-colors"
        >
          <ChevronLeft class="w-4 h-4 shrink-0" />
        </button>
        <span class="text-xs font-extrabold text-theme-text-muted px-1.5"> {{ currentTaskIndex + 1 }} / {{ totalTasks }} </span>
        <button
          @click="emit('next')"
          class="p-2 bg-theme-column hover:bg-theme-column/80 border border-theme-border/60 text-theme-text-muted hover:text-theme-text-main rounded-lg cursor-pointer transition-colors"
        >
          <ChevronRight class="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  </div>
</template>
