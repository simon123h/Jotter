<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { Paperclip, Slash, Plus, FileText, Download, Trash2 } from '@lucide/vue';
import { uploadAttachment, deleteAttachment, getAttachmentUrl } from '@/api';
import type { Task } from '@/types';

const props = defineProps<{
  projectId: string;
  taskId: string;
  attachments: string[];
}>();

const emit = defineEmits<{
  (e: 'update-task', updated: Task): void;
  (e: 'error', message: string): void;
  (e: 'preview-image', filename: string): void;
}>();

const { t } = useI18n();

const isUploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const isImageFile = (filename: string): boolean => {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(filename);
};

const handlePreviewImage = (filename: string) => {
  emit('preview-image', filename);
};

const openAttachmentInNewTab = (filename: string) => {
  const url = getAttachmentUrl(props.projectId, props.taskId, filename);
  window.open(url, '_blank');
};

const triggerFileUpload = () => {
  fileInput.value?.click();
};

const uploadFiles = async (files: FileList) => {
  if (files.length === 0) return;
  isUploading.value = true;
  try {
    let lastUpdated: Task | null = null;
    for (let i = 0; i < files.length; i++) {
      lastUpdated = await uploadAttachment(props.projectId, props.taskId, files[i]);
    }
    if (lastUpdated) {
      emit('update-task', lastUpdated);
    }
  } catch (err: any) {
    emit('error', t('errors.updateTask', { message: err.message || err }));
  } finally {
    isUploading.value = false;
  }
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  await uploadFiles(input.files);
  input.value = ''; // Reset input
};

const handleRemoveAttachment = async (filename: string) => {
  if (!confirm(t('form.deleteAttachmentConfirm'))) return;

  try {
    const updated = await deleteAttachment(props.projectId, props.taskId, filename);
    emit('update-task', updated);
  } catch (err: any) {
    emit('error', t('errors.updateTask', { message: err.message || err }));
  }
};

// Expose the uploadFiles function for external drag-and-drop orchestration
defineExpose({
  uploadFiles,
});
</script>

<template>
  <div class="mt-4 pt-4 border-t border-theme-border">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-xs font-bold uppercase tracking-widest text-theme-text-muted flex items-center gap-1.5">
        <Paperclip class="w-3.5 h-3.5" />
        {{ t('form.attachmentsLabel') }}
      </h3>
      <button
        @click="triggerFileUpload"
        class="text-[10px] font-bold uppercase tracking-wider text-theme-accent hover:text-theme-primary transition-colors flex items-center gap-1 cursor-pointer"
        :disabled="isUploading"
      >
        <template v-if="isUploading">
          <Slash class="w-3 h-3 animate-spin" />
          {{ t('form.uploading') }}
        </template>
        <template v-else>
          <Plus class="w-3 h-3" />
          {{ t('form.addAttachment') }}
        </template>
      </button>
      <input ref="fileInput" type="file" class="hidden" @change="handleFileUpload" />
    </div>

    <div v-if="attachments && attachments.length" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div
        v-for="file in attachments"
        :key="file"
        class="group/att flex items-center justify-between p-2 rounded bg-theme-column/20 border border-theme-border/50 hover:border-theme-accent/30 transition-all animate-fade-in"
      >
        <div
          class="flex items-center gap-2 min-w-0 cursor-pointer select-none group/item flex-grow py-0.5"
          @click="isImageFile(file) ? handlePreviewImage(file) : openAttachmentInNewTab(file)"
        >
          <!-- Mini Image Preview Thumbnail -->
          <div
            v-if="isImageFile(file)"
            class="w-8 h-8 rounded overflow-hidden bg-slate-900 border border-theme-border/50 flex items-center justify-center shrink-0"
          >
            <img
              :src="getAttachmentUrl(projectId, taskId, file)"
              class="w-full h-full object-cover transition-transform duration-200 group-hover/item:scale-110"
            />
          </div>
          <div
            v-else
            class="w-8 h-8 rounded bg-theme-card border border-theme-border/50 flex items-center justify-center shrink-0"
          >
            <FileText class="w-4 h-4 text-theme-text-muted shrink-0" />
          </div>
          <span
            class="text-xs text-theme-text-main truncate font-medium group-hover/item:text-theme-accent transition-colors"
            >{{ file }}</span
          >
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover/att:opacity-100 transition-opacity shrink-0 ml-2">
          <a
            :href="getAttachmentUrl(projectId, taskId, file)"
            target="_blank"
            class="p-1 text-theme-text-muted hover:text-theme-accent transition-colors cursor-pointer"
            :title="t('buttons.download')"
            @click.stop
          >
            <Download class="w-3.5 h-3.5" />
          </a>
          <button
            @click="handleRemoveAttachment(file)"
            class="p-1 text-theme-text-muted hover:text-rose-400 transition-colors cursor-pointer"
            :title="t('buttons.delete')"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
    <div v-else class="text-xs text-theme-text-muted italic opacity-50 py-2">
      {{ t('form.noAttachments') }}
    </div>
  </div>
</template>
