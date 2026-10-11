<script setup lang="ts">
import { ref, computed } from 'vue';
import { Inbox, LayoutGrid } from '@lucide/vue';
import { useProjectStore } from '@/stores/project';
import { useSelectionStore } from '@/stores/selection';
import { useI18n } from '@/composables/useI18n';
import BaseModal from '@/components/ui/BaseModal.vue';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  taskIds: string[];
  targetProjectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const projectStore = useProjectStore();
const selectionStore = useSelectionStore();

const selectedOption = ref<'default' | 'keep'>('default');

const targetProject = computed(() => {
  return projectStore.projects.find((p) => p.id === props.targetProjectId);
});

const handleProceed = async () => {
  try {
    const resetToDefaultBucket = selectedOption.value === 'default';
    await projectStore.moveTasksToProject(props.taskIds, props.targetProjectId, {
      resetToDefaultBucket,
    });
    selectionStore.clearSelection();
    await projectStore.invalidate();
    emit('close');
  } catch (err: any) {
    projectStore.error = `Failed to move tasks: ${err.message}`;
  }
};
</script>

<template>
  <BaseModal :is-open="isOpen" max-width="max-w-md" :title="t('moveTasksModal.title')" @close="emit('close')">
    <!-- Body -->
    <div class="p-4 space-y-4">
      <p
        class="text-sm text-theme-text-muted leading-relaxed"
        v-html="
          t('moveTasksModal.subtitle', {
            count: `<span class='font-bold text-theme-text-main'>${taskIds.length}</span>`,
            project: `<span class='font-bold text-theme-text-main'>${targetProject?.title || 'another project'}</span>`,
          })
        "
      ></p>

      <div class="grid grid-cols-1 gap-3">
        <!-- Option: Move to Default Bucket -->
        <button
          type="button"
          @click="selectedOption = 'default'"
          class="flex items-start gap-3 p-3.5 rounded border text-left transition-all duration-200 cursor-pointer"
          :class="
            selectedOption === 'default'
              ? 'border-theme-primary bg-theme-primary/10 text-theme-accent ring-1 ring-theme-primary'
              : 'border-theme-border bg-theme-card hover:bg-theme-column/20 text-theme-text-muted hover:text-theme-text-main'
          "
        >
          <Inbox class="w-5 h-5 shrink-0 mt-0.5" :class="selectedOption === 'default' ? 'text-theme-primary' : 'text-theme-text-muted'" />
          <div>
            <div class="font-bold text-sm text-theme-text-main">{{ t('moveTasksModal.defaultColumnTitle') }}</div>
            <div class="text-xs text-theme-text-muted mt-0.5">
              {{ t('moveTasksModal.defaultColumnDesc') }}
            </div>
          </div>
        </button>

        <!-- Option: Keep Current Bucket -->
        <button
          type="button"
          @click="selectedOption = 'keep'"
          class="flex items-start gap-3 p-3.5 rounded border text-left transition-all duration-200 cursor-pointer"
          :class="
            selectedOption === 'keep'
              ? 'border-theme-primary bg-theme-primary/10 text-theme-accent ring-1 ring-theme-primary'
              : 'border-theme-border bg-theme-card hover:bg-theme-column/20 text-theme-text-muted hover:text-theme-text-main'
          "
        >
          <LayoutGrid class="w-5 h-5 shrink-0 mt-0.5" :class="selectedOption === 'keep' ? 'text-theme-primary' : 'text-theme-text-muted'" />
          <div>
            <div class="font-bold text-sm text-theme-text-main">{{ t('moveTasksModal.keepColumnsTitle') }}</div>
            <div class="text-xs text-theme-text-muted mt-0.5">{{ t('moveTasksModal.keepColumnsDesc') }}</div>
          </div>
        </button>
      </div>

      <!-- Footer Actions -->
      <div class="flex justify-end gap-2 pt-2 border-t border-theme-border">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 border border-theme-border rounded text-sm font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
        >
          {{ t('moveTasksModal.cancel') }}
        </button>
        <button
          type="button"
          @click="handleProceed"
          class="px-5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-sm font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
        >
          {{ t('moveTasksModal.confirm') }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
