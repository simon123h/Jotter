<script setup lang="ts">
import { ref } from 'vue';
import { Upload, AlertCircle, Info } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';

defineProps<{
  isDragging: boolean;
  fileError: string | null;
}>();

const emit = defineEmits<{
  (e: 'dragover', event: DragEvent): void;
  (e: 'dragleave'): void;
  (e: 'drop', event: DragEvent): void;
  (e: 'file-select', event: Event): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const { t } = useI18n();

const triggerFileSelect = () => {
  fileInput.value?.click();
};
</script>

<template>
  <div class="space-y-4">
    <div
      @dragover="emit('dragover', $event)"
      @dragleave="emit('dragleave')"
      @drop="emit('drop', $event)"
      class="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none"
      :class="[
        isDragging
          ? 'border-theme-primary bg-theme-primary/5 scale-[0.99] shadow-inner'
          : 'border-theme-border hover:border-theme-primary/60 hover:bg-theme-column/10',
      ]"
      @click="triggerFileSelect"
    >
      <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="emit('file-select', $event)" />
      <div class="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-500">
        <Upload class="w-7 h-7" :class="{ 'animate-bounce': isDragging }" />
      </div>
      <p class="text-sm font-semibold text-theme-text-main">{{ t('importWizard.dragDropText') }}</p>
      <p class="text-xs text-theme-text-muted mt-1 max-w-sm">{{ t('importWizard.dragDropSubtitle') }}</p>
      <span
        class="mt-4 px-3 py-1.5 bg-theme-card border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary transition-all"
      >
        {{ t('importWizard.browseFiles') }}
      </span>
    </div>

    <div v-if="fileError" class="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex items-center gap-2">
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span>{{ fileError }}</span>
    </div>

    <!-- Helpful Notice -->
    <div class="p-4 bg-theme-card/30 border border-theme-border/50 rounded-lg flex gap-3">
      <Info class="w-5 h-5 text-theme-accent shrink-0 mt-0.5" />
      <div class="space-y-1">
        <h4 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">{{ t('importWizard.formattingTipTitle') }}</h4>
        <p class="text-[11px] text-theme-text-muted leading-relaxed">
          {{ t('importWizard.formattingTipText') }}
        </p>
      </div>
    </div>
  </div>
</template>
