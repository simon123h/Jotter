<script setup lang="ts">
import { computed } from 'vue';
import { ClipboardList } from '@lucide/vue';
import type { ChecklistStats } from '@/utils/checklist';

const props = defineProps<{
  stats: ChecklistStats;
  compact?: boolean;
}>();

const isComplete = computed(() => props.stats.checked === props.stats.total);
</script>

<template>
  <div
    class="flex items-center gap-1 font-semibold"
    :class="[
      isComplete ? 'text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20' : 'text-theme-text-muted',
      { 'text-[10px]': compact },
    ]"
  >
    <ClipboardList :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
    <span>{{ stats.checked }}/{{ stats.total }}</span>
  </div>
</template>
