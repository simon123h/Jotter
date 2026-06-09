<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { X, Inbox, LayoutGrid } from '@lucide/vue';
import { useProjectStore } from '@/stores/project';
import { useSelectionStore } from '@/stores/selection';
import { useI18n } from '@/composables/useI18n';

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

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

      <!-- Modal Content -->
      <div
        class="relative bg-theme-base border border-theme-border w-full max-w-md rounded shadow-2xl overflow-hidden flex flex-col z-10 animate-scale-in"
      >
        <!-- Header -->
        <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
          <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{{ t('moveTasksModal.title') }}</h3>
          <button
            @click="emit('close')"
            class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
          >
            <X class="w-4 h-4 shrink-0" />
          </button>
        </div>

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
              <Inbox
                class="w-5 h-5 shrink-0 mt-0.5"
                :class="selectedOption === 'default' ? 'text-theme-primary' : 'text-theme-text-muted'"
              />
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
              <LayoutGrid
                class="w-5 h-5 shrink-0 mt-0.5"
                :class="selectedOption === 'keep' ? 'text-theme-primary' : 'text-theme-text-muted'"
              />
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
      </div>
    </div>
  </transition>
</template>
