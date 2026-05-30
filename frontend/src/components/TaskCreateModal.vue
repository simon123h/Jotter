<script setup lang="ts">
import { ref, watch } from 'vue';
import type { BucketName } from '../types';
import { createTask } from '../api';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
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

    await createTask({
      title: title.value.trim(),
      bucket: bucket.value,
      tags: tagArray,
      body: body.value,
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
      class="relative bg-theme-base border border-theme-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
        <h3 class="text-lg font-bold text-theme-text-main">{{ t('createModalTitle') }}</h3>
        <button
          @click="emit('close')"
          class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1.5 hover:bg-theme-card rounded-lg cursor-pointer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Error Alert -->
      <div v-if="error" class="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
        {{ error }}
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSubmit" class="p-6 overflow-y-auto flex-grow space-y-4">
        <!-- Title -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">{{ t('form.titleLabel') }}</label>
          <input
            v-model="title"
            type="text"
            required
            class="w-full bg-theme-base/60 border border-theme-border rounded-xl px-4 py-2.5 text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            :placeholder="t('form.titlePlaceholder')"
          />
        </div>

        <!-- Bucket & Tags Row -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">{{ t('form.columnLabel') }}</label>
            <select
              v-model="bucket"
              class="w-full bg-theme-base/60 border border-theme-border rounded-xl px-4 py-2.5 text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            >
              <option v-for="b in buckets" :key="b.name" :value="b.name">{{ t('buckets.' + b.name) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">{{ t('form.tagsLabel') }}</label>
            <input
              v-model="tags"
              type="text"
              class="w-full bg-theme-base/60 border border-theme-border rounded-xl px-4 py-2.5 text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              :placeholder="t('form.tagsPlaceholder')"
            />
          </div>
        </div>

        <!-- Body (Markdown Textarea) -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
            {{ t('form.markdownLabel') }}
          </label>
          <textarea
            v-model="body"
            rows="6"
            class="w-full bg-theme-base/60 border border-theme-border rounded-xl p-4 text-theme-text-input font-mono text-sm focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            :placeholder="t('form.markdownPlaceholder')"
          ></textarea>
        </div>
      </form>

      <!-- Footer Buttons -->
      <div class="px-6 py-4 border-t border-theme-border flex justify-end gap-2 bg-theme-card/30 shrink-0">
        <button
          type="button"
          @click="emit('close')"
          class="text-xs font-semibold px-4.5 py-2.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded-xl transition-all cursor-pointer"
          :disabled="loading"
        >
          {{ t('buttons.cancel') }}
        </button>
        <button
          type="submit"
          @click="handleSubmit"
          class="text-xs font-semibold px-4.5 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-xl shadow-md hover:shadow-theme-ring transition-all flex items-center gap-2 cursor-pointer"
          :disabled="loading"
        >
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          {{ t('buttons.create') }}
        </button>
      </div>
    </div>
  </div>
</template>
