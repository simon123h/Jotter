<script setup lang="ts">
import { ref, watch } from 'vue';
import type { BucketName } from '../types';
import { createTask } from '../api';

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
    error.value = 'Title is required';
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
    error.value = err.message || 'Failed to create task';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
  >
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      @click="emit('close')"
    ></div>

    <!-- Modal Content -->
    <div
      class="relative bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h3 class="text-lg font-bold text-slate-100">Create New Task</h3>
        <button
          @click="emit('close')"
          class="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-lg"
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
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Title *</label>
          <input
            v-model="title"
            type="text"
            required
            class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            placeholder="What needs to be done?"
          />
        </div>

        <!-- Bucket & Tags Row -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Column</label>
            <select
              v-model="bucket"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              <option v-for="b in buckets" :key="b.name" :value="b.name">{{ b.title }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tags (comma-separated)</label>
            <input
              v-model="tags"
              type="text"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="e.g. bug, high-priority"
            />
          </div>
        </div>

        <!-- Body (Markdown Textarea) -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Markdown Description
          </label>
          <textarea
            v-model="body"
            rows="6"
            class="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-100 font-mono text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            placeholder="Write notes, checklists, or steps in markdown..."
          ></textarea>
        </div>
      </form>

      <!-- Footer Buttons -->
      <div class="px-6 py-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/30 shrink-0">
        <button
          type="button"
          @click="emit('close')"
          class="text-xs font-semibold px-4.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all"
          :disabled="loading"
        >
          Cancel
        </button>
        <button
          type="submit"
          @click="handleSubmit"
          class="text-xs font-semibold px-4.5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-md hover:shadow-violet-500/10 transition-all flex items-center gap-2"
          :disabled="loading"
        >
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          Create Task
        </button>
      </div>
    </div>
  </div>
</template>
