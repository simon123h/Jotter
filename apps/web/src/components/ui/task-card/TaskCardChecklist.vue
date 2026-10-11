<script setup lang="ts">
import type { ChecklistItem, ChecklistStats } from '@/utils/checklist';
import ChecklistProgress from './ChecklistProgress.vue';

defineProps<{
  items: ChecklistItem[];
  stats: ChecklistStats | null;
}>();

const emit = defineEmits<{
  (e: 'toggle', globalIndex: number, checked: boolean): void;
}>();
</script>

<template>
  <div class="task-card-checklist flex flex-col gap-1.5 mt-1 pt-2 border-t border-theme-border/20 relative pr-14" @click.stop>
    <!-- Floating progress at the top-right corner of the checklist box -->
    <ChecklistProgress v-if="stats" :stats="stats" class="absolute top-2 right-0 pointer-events-none select-none text-xs" />

    <label
      v-for="item in items"
      :key="item.globalIndex"
      class="flex items-start gap-2 text-xs text-theme-text-card cursor-pointer hover:text-theme-text-main transition-colors select-none"
      :class="{ 'line-through text-theme-text-muted/60': item.checked }"
      :style="{ paddingLeft: `${item.level * 16}px` }"
    >
      <input
        type="checkbox"
        :checked="item.checked"
        @click.stop.prevent="emit('toggle', item.globalIndex, !item.checked)"
        class="mt-0.5 rounded border-theme-border text-theme-accent focus:ring-theme-accent/30 cursor-pointer"
      />
      <span class="leading-snug break-words">{{ item.label }}</span>
    </label>
  </div>
</template>
