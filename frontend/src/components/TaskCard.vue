<script setup lang="ts">
import type { Task } from '../types';

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  (e: 'click', task: Task): void;
}>();

// Helper to assign a consistent, pleasant color theme to each tag
const getTagClasses = (tag: string) => {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const themes = [
    'bg-red-500/10 text-red-400 border-red-500/20',
    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'bg-teal-500/10 text-teal-400 border-teal-500/20',
    'bg-sky-500/10 text-sky-400 border-sky-500/20',
    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  ];
  return themes[hash % themes.length];
};
</script>

<template>
  <div
    class="bg-theme-card border border-theme-border p-4 rounded-xl shadow-sm hover:shadow-md hover:border-theme-accent/50 hover:shadow-theme-ring hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col gap-3"
    @click="emit('click', task)"
  >
    <div class="flex justify-between items-start gap-2">
      <h4 class="font-medium text-theme-text-card group-hover:text-theme-primary transition-colors line-clamp-2">
        {{ task.title }}
      </h4>
      <span class="text-xs font-mono text-theme-text-muted shrink-0">#{{ task.id }}</span>
    </div>

    <!-- Tags List -->
    <div v-if="task.tags && task.tags.length" class="flex flex-wrap gap-1">
      <span
        v-for="tag in task.tags"
        :key="tag"
        class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
        :class="getTagClasses(tag)"
      >
        {{ tag }}
      </span>
    </div>
  </div>
</template>
