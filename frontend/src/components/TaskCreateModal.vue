<script setup lang="ts">
import { ref, watch } from 'vue';
import { X } from '@lucide/vue';
import type { BucketName } from '../types';
import { createTask } from '../api';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  projectId: string;
  defaultBucket: BucketName;
  buckets: { name: BucketName; title: string }[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const title = ref('');
const bucket = ref<BucketName>('todo');
const tags = ref('');
const body = ref('');
const dueDate = ref('');
const priority = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

// Reset form when modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      title.value = '';
      bucket.value = props.defaultBucket;
      tags.value = '';
      body.value = '';
      dueDate.value = '';
      priority.value = '';
      error.value = null;
    }
  }
);

const handleSubmit = async () => {
  if (!title.value.trim()) {
    error.value = t('errors.titleRequired');
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const tagArray = tags.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await createTask(props.projectId, {
      title: title.value.trim(),
      bucket: bucket.value,
      tags: tagArray,
      body: body.value,
      due_date: dueDate.value || undefined,
      priority: priority.value || undefined,
    });

    emit('created');
    emit('close');
  } catch (err: any) {
    error.value = t('errors.createTask', { message: err.message || err });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
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
          <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.titleLabel') }}</label>
          <input
            v-model="title"
            type="text"
            required
            class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            :placeholder="t('form.titlePlaceholder')"
          />
        </div>

        <!-- Bucket & Tags Row -->
        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
              t('form.columnLabel')
            }}</label>
            <select
              v-model="bucket"
              class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            >
              <option v-for="b in buckets" :key="b.name" :value="b.name">{{ t('buckets.' + b.name) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.tagsLabel') }}</label>
            <input
              v-model="tags"
              type="text"
              class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              :placeholder="t('form.tagsPlaceholder')"
            />
          </div>
        </div>

        <!-- Due Date & Priority Row -->
        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
              t('form.dueDateLabel')
            }}</label>
            <input
              v-model="dueDate"
              type="date"
              class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{
              t('form.priorityLabel')
            }}</label>
            <select
              v-model="priority"
              class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
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
          <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1">
            {{ t('form.markdownLabel') }}
          </label>
          <textarea
            v-model="body"
            rows="8"
            class="w-full bg-theme-base/60 border border-theme-border rounded p-3 text-xs text-theme-text-input font-mono focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring scroller-thin"
            :placeholder="t('form.markdownPlaceholder')"
          ></textarea>
        </div>
      </form>

      <!-- Footer Buttons -->
      <div class="px-4 py-3 border-t border-theme-border flex justify-end gap-2 bg-theme-card/30 shrink-0">
        <button
          type="button"
          @click="emit('close')"
          class="text-xs font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
          :disabled="loading"
        >
          {{ t('buttons.cancel') }}
        </button>
        <button
          type="submit"
          @click="handleSubmit"
          class="text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          :disabled="loading"
        >
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          {{ t('buttons.create') }}
        </button>
      </div>
    </div>
  </div>
</template>
