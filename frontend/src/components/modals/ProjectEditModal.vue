<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { X, Trash2 } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { useProjects } from '@/composables/useProjects';
import { useProjectStore } from '@/stores/project';
import type { Project } from '@/types';

const { t } = useI18n();
const projectStore = useProjectStore();

const props = defineProps<{
  isOpen: boolean;
  project: Project | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// Composable: Projects Management
const { handleSaveProject, handleDeleteProject } = useProjects(() => {});

const title = ref('');
const doneCleanPeriod = ref<number | null>(null);
const gitRemote = ref('');
const titleInput = ref<HTMLInputElement | null>(null);

// Watch for modal open and project changes to initialize values
watch(
  [() => props.isOpen, () => props.project],
  ([open, project]) => {
    if (open && project) {
      title.value = project.title || '';
      doneCleanPeriod.value =
        project.done_clean_period !== undefined && project.done_clean_period !== null ? project.done_clean_period : null;
      gitRemote.value = project.git_remote || '';
      nextTick(() => {
        titleInput.value?.focus();
      });
    }
  },
  { immediate: true }
);

const handleSave = async () => {
  const cleanTitle = (title.value || '').trim();
  if (!cleanTitle || !props.project) return;

  let parsedPeriod: number | null = null;
  if (doneCleanPeriod.value !== null && doneCleanPeriod.value !== undefined) {
    const valStr = String(doneCleanPeriod.value).trim();
    if (valStr !== '') {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        parsedPeriod = parsed === 0 ? null : parsed;
      }
    }
  }

  await handleSaveProject({
    id: props.project.id,
    title: cleanTitle,
    done_clean_period: parsedPeriod,
    git_remote: gitRemote.value.trim() || null,
  });
  await projectStore.fetchProjects();
  emit('close');
};

const closeAndSave = async () => {
  const cleanTitle = (title.value || '').trim();
  if (cleanTitle && props.project) {
    await handleSave();
  } else {
    emit('close');
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    closeAndSave();
  }
};

const handleDelete = async () => {
  if (!props.project) return;
  await handleDeleteProject(props.project);
  await projectStore.fetchProjects();
  emit('close');
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
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="closeAndSave"></div>

      <!-- Modal Content -->
      <div class="relative bg-theme-base border border-theme-border w-full max-w-md rounded shadow-2xl overflow-hidden flex flex-col z-10">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
          <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{{ t('projectEdit.title') }}</h3>
          <button
            @click="closeAndSave"
            class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
          >
            <X class="w-4 h-4 shrink-0" />
          </button>
        </div>

        <!-- Form Body -->
        <form @submit.prevent="handleSave" class="p-4 space-y-4">
          <!-- Title Input -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
              {{ t('projectEdit.titleLabel') }}
            </label>
            <input
              ref="titleInput"
              v-model="title"
              type="text"
              required
              maxlength="100"
              class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
            />
          </div>

          <!-- Done Task Deletion Period Input -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
              {{ t('projectEdit.prunePeriodLabel') }}
            </label>
            <input
              v-model.number="doneCleanPeriod"
              type="number"
              min="0"
              :placeholder="t('projectEdit.prunePeriodPlaceholder')"
              class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
            />
            <p class="mt-1 text-[11px] text-theme-text-muted leading-relaxed">
              {{ t('projectEdit.prunePeriodHelp') }}
            </p>
          </div>

          <!-- Git Remote URL Input -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
              {{ t('projectEdit.gitRemoteLabel') }}
            </label>
            <input
              v-model="gitRemote"
              type="text"
              :placeholder="t('projectEdit.gitRemotePlaceholder')"
              class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
            />
            <p class="mt-1 text-[11px] text-theme-text-muted leading-relaxed">
              {{ t('projectEdit.gitRemoteHelp') }}
            </p>
          </div>

          <!-- Footer Action Buttons -->
          <div class="flex justify-end items-center gap-2 pt-2 border-t border-theme-border mt-4">
            <!-- Delete Project Button -->
            <button
              type="button"
              @click="handleDelete"
              class="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded text-xs font-semibold transition-all cursor-pointer mr-auto"
            >
              <Trash2 class="w-3.5 h-3.5" /> {{ t('projectEdit.deleteButton') || 'Delete' }}
            </button>

            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 border border-theme-border rounded text-sm font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
            >
              {{ t('buttons.cancel') }}
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-sm font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              {{ t('projectEdit.saveButton') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </transition>
</template>
