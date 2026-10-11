<script setup lang="ts">
import { X, Trash2, Archive, ArchiveRestore, Check, Pencil, Save } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Task } from '@/types';

defineProps<{
  task: Task | null;
  isEditing: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
  (e: 'archive'): void;
  (e: 'unarchive'): void;
  (e: 'mark-done'): void;
  (e: 'edit'): void;
  (e: 'cancel'): void;
  (e: 'save'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="px-4 py-3 border-t border-theme-border flex flex-wrap justify-between items-center gap-2 bg-theme-card/30 shrink-0">
    <div>
      <button
        v-if="task && !isEditing"
        @click="emit('delete')"
        class="text-sm font-semibold px-2.5 sm:px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        :title="t('buttons.delete')"
      >
        <Trash2 class="w-4 h-4" />
        <span class="hidden sm:inline">{{ t('buttons.delete') }}</span>
      </button>
    </div>
    <div class="flex flex-wrap items-center gap-2 ml-auto">
      <!-- View mode buttons -->
      <template v-if="!isEditing">
        <button
          v-if="task && task.bucket !== 'archive'"
          @click="emit('archive')"
          class="text-sm font-semibold px-2.5 sm:px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 rounded transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          :title="t('buttons.archive')"
        >
          <Archive class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('buttons.archive') }}</span>
        </button>
        <button
          v-if="task && task.bucket === 'archive'"
          @click="emit('unarchive')"
          class="text-sm font-semibold px-2.5 sm:px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          :title="t('buttons.unarchive')"
        >
          <ArchiveRestore class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('buttons.unarchive') }}</span>
        </button>
        <button
          v-if="task && task.bucket !== 'done' && task.bucket !== 'archive'"
          @click="emit('mark-done')"
          class="text-sm font-semibold px-2.5 sm:px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          :title="t('buttons.markDone')"
        >
          <Check class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('buttons.markDone') }}</span>
        </button>
        <button
          @click="emit('edit')"
          class="text-sm font-semibold px-2.5 sm:px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25 rounded transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          :title="t('buttons.edit')"
        >
          <Pencil class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('buttons.edit') }}</span>
        </button>
      </template>

      <!-- Edit mode buttons -->
      <template v-else>
        <button
          @click="emit('cancel')"
          class="text-sm font-semibold px-2.5 sm:px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          :disabled="loading"
          :title="t('buttons.cancel')"
        >
          <X class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('buttons.cancel') }}</span>
        </button>
        <button
          @click="emit('save')"
          class="text-sm font-semibold px-2.5 sm:px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          :disabled="loading"
          :title="t('buttons.save')"
        >
          <span v-if="loading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <Save v-else class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('buttons.save') }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
