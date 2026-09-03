<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Trash2 } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useDialog } from '@/composables/useDialog';
import { updateProject, deleteProject } from '@/api';
import BaseModal from '@/components/ui/BaseModal.vue';
import type { Project } from '@/types';

const { t } = useI18n();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const { showDialog } = useDialog();

const props = defineProps<{
  isOpen: boolean;
  project: Project | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const title = ref('');
const doneCleanPeriod = ref<number | null>(null);
const gitRemote = ref('');
const titleInput = ref<HTMLInputElement | null>(null);

const doneCleanPeriodPlaceholder = computed(() => {
  if (settingsStore.doneCleanPeriod && settingsStore.doneCleanPeriod > 0) {
    return t('projectEdit.globalInherited', { days: settingsStore.doneCleanPeriod });
  }
  return t('projectEdit.doneCleanPeriodPlaceholder');
});

// Watch for modal open and project changes to initialize values
watch(
  [() => props.isOpen, () => props.project],
  ([open, currentProject]) => {
    if (open && currentProject) {
      title.value = currentProject.title;
      doneCleanPeriod.value = currentProject.done_clean_period ?? null;
      gitRemote.value = currentProject.git_remote || '';

      nextTick(() => {
        titleInput.value?.focus();
      });
    }
  },
  { immediate: true }
);

const handleSave = async () => {
  if (!props.project || !title.value.trim()) return;

  let cleanPeriod: number | null = null;
  if (doneCleanPeriod.value !== null && doneCleanPeriod.value !== undefined && String(doneCleanPeriod.value).trim() !== '') {
    const parsed = Number(doneCleanPeriod.value);
    if (!isNaN(parsed) && parsed >= 0) {
      cleanPeriod = Math.floor(parsed);
    }
  }

  await updateProject(props.project.id, {
    title: title.value.trim(),
    done_clean_period: cleanPeriod,
    git_remote: gitRemote.value.trim() || undefined,
  });

  await projectStore.invalidate();
  emit('close');
};

const handleDelete = async () => {
  if (!props.project) return;
  const confirmed = await showDialog({
    title: t('projectEdit.deleteDialogTitle', { title: props.project.title }),
    message: t('projectEdit.deleteDialogMessage'),
    type: 'error',
    showCancel: true,
    confirmText: t('buttons.delete'),
    cancelText: t('buttons.cancel'),
  });

  if (confirmed) {
    await deleteProject(props.project.id);
    await projectStore.invalidate();
    emit('close');
  }
};

const closeAndSave = async () => {
  if (props.project && title.value.trim()) {
    await handleSave();
  } else {
    emit('close');
  }
};
</script>

<template>
  <BaseModal :is-open="isOpen" max-width="max-w-md" :title="t('projectEdit.title')" @close="closeAndSave">
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
          {{ t('projectEdit.doneCleanPeriodLabel') }}
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model.number="doneCleanPeriod"
            type="number"
            min="0"
            max="365"
            :placeholder="doneCleanPeriodPlaceholder"
            class="w-32 bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
          />
          <span class="text-xs text-theme-text-muted">{{ t('projectEdit.days') }}</span>
        </div>
        <p class="text-[11px] text-theme-text-muted mt-1 leading-tight">
          {{ t('projectEdit.doneCleanPeriodHelp') }}
        </p>
      </div>

      <!-- Git Remote URL -->
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
          {{ t('projectEdit.gitRemoteLabel') }}
        </label>
        <input
          v-model="gitRemote"
          type="text"
          :placeholder="t('projectEdit.gitRemotePlaceholder')"
          class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary font-mono text-xs"
        />
        <p class="text-[11px] text-theme-text-muted mt-1 leading-tight">
          {{ t('projectEdit.gitRemoteHelp') }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-4 border-t border-theme-border">
        <button
          type="button"
          @click="handleDelete"
          class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
          {{ t('projectEdit.deleteButton') }}
        </button>

        <div class="flex items-center gap-2">
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
      </div>
    </form>
  </BaseModal>
</template>
