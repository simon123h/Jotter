<script setup lang="ts">
import { CheckCircle2 } from '@lucide/vue';

defineProps<{
  importSummary: {
    success: number;
    skipped: number;
    failed: number;
  };
}>();
</script>

<template>
  <div class="space-y-6 py-6 text-center">
    <div class="flex flex-col items-center">
      <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
        <CheckCircle2 class="w-8 h-8" />
      </div>
      <h4 class="text-sm font-bold text-theme-text-main">Import Completed!</h4>
      <p class="text-xs text-theme-text-muted mt-1">Tasks have been parsed and synced to Jotter's local markdown repository.</p>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-3 gap-3 max-w-sm mx-auto">
      <div class="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-center">
        <span class="text-xs text-theme-text-muted block">Created</span>
        <span class="text-lg font-bold text-emerald-500 block">{{ importSummary.success }}</span>
      </div>
      <div class="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg text-center">
        <span class="text-xs text-theme-text-muted block">Skipped</span>
        <span class="text-lg font-bold text-yellow-500 block">{{ importSummary.skipped }}</span>
      </div>
      <div class="p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-center">
        <span class="text-xs text-theme-text-muted block">Failed</span>
        <span class="text-lg font-bold text-red-500 block">{{ importSummary.failed }}</span>
      </div>
    </div>

    <!-- Informational message -->
    <p class="text-[11px] text-theme-text-muted max-w-md mx-auto leading-relaxed">
      Jotter indexing automatically rebuilt the local index. Your new tasks will immediately appear on the Kanban board and in the
      schedule views.
    </p>
  </div>
</template>
