<script setup lang="ts">
import { computed, watch } from 'vue';
import { X, FileSpreadsheet, ChevronRight, ChevronLeft, ArrowRight } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { useImportWizard } from '@/features/task-import/composables/useImportWizard';
import StepUpload from '@/features/task-import/components/StepUpload.vue';
import StepColumnMapper from '@/features/task-import/components/StepColumnMapper.vue';
import StepRowPreview from '@/features/task-import/components/StepRowPreview.vue';
import StepProgress from '@/features/task-import/components/StepProgress.vue';
import StepSummary from '@/features/task-import/components/StepSummary.vue';
import BaseModal from '@/components/ui/BaseModal.vue';

const props = defineProps<{
  isOpen: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const {
  currentStep,
  isDragging,
  fileName,
  fileError,
  excelHeaders,
  excelRows,
  mappings,
  bucketStrategy,
  fallbackBucket,
  skipDuplicates,
  appendTags,
  selectedRows,
  importProgressCurrent,
  importProgressTotal,
  logs,
  importSummary,
  isImporting,
  sheetNames,
  selectedSheetName,
  resetState,
  loadSheet,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileSelect,
  availableBuckets,
  nextToPreview,
  prevStep,
  runImport,
  toggleRow,
  toggleSelectAll,
  parseExcelPriority,
  parseExcelDate,
  getDestinationBucketInfo,
  getBucketTitle,
} = useImportWizard(computed(() => props.projectId));

const { t } = useI18n();

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) resetState();
  },
  { immediate: true }
);
</script>

<template>
  <BaseModal
    :is-open="isOpen"
    max-width="max-w-2xl"
    content-class="max-h-[85vh]"
    :close-on-backdrop="!isImporting"
    :close-on-esc="!isImporting"
    :show-close-button="false"
    @close="!isImporting && emit('close')"
  >
    <template #header>
      <div class="px-5 py-4 border-b border-theme-border flex justify-between items-center bg-theme-card/50 shrink-0">
        <div class="flex items-center gap-2">
          <FileSpreadsheet class="w-5 h-5 text-emerald-500" />
          <div>
            <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{{ t('importWizard.modalTitle') }}</h3>
            <p class="text-[11px] text-theme-text-muted">{{ t('importWizard.modalSubtitle') }}</p>
          </div>
        </div>
        <button
          v-if="!isImporting"
          type="button"
          @click="emit('close')"
          class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1.5 hover:bg-theme-card rounded cursor-pointer"
        >
          <X class="w-4 h-4 shrink-0" />
        </button>
      </div>
    </template>

    <!-- Scrollable Content Area -->
    <div class="flex-grow overflow-y-auto p-5 scroller-thin">
      <!-- STEP 1: UPLOAD FILE -->
      <StepUpload
        v-if="currentStep === 1"
        :is-dragging="isDragging"
        :file-error="fileError"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        @file-select="handleFileSelect"
      />

      <!-- STEP 2: COLUMN MAPPING & STRATEGY -->
      <StepColumnMapper
        v-if="currentStep === 2"
        v-model:mappings="mappings"
        v-model:bucket-strategy="bucketStrategy"
        v-model:fallback-bucket="fallbackBucket"
        v-model:skip-duplicates="skipDuplicates"
        v-model:append-tags="appendTags"
        v-model:selected-sheet-name="selectedSheetName"
        :file-name="fileName"
        :excel-rows-length="excelRows.length"
        :sheet-names="sheetNames"
        :excel-headers="excelHeaders"
        :available-buckets="availableBuckets"
        @load-sheet="loadSheet"
      />

      <!-- STEP 3: PREVIEW & SELECTION -->
      <StepRowPreview
        v-if="currentStep === 3"
        :excel-rows="excelRows"
        :selected-rows="selectedRows"
        :mappings="mappings"
        :bucket-strategy="bucketStrategy"
        :fallback-bucket="fallbackBucket"
        :get-destination-bucket-info="getDestinationBucketInfo"
        :get-bucket-title="getBucketTitle"
        :parse-excel-priority="parseExcelPriority"
        :parse-excel-date="parseExcelDate"
        @toggle-row="toggleRow"
        @toggle-select-all="toggleSelectAll"
      />

      <!-- STEP 4: IMPORTING PROGRESS -->
      <StepProgress
        v-if="currentStep === 4"
        :import-progress-current="importProgressCurrent"
        :import-progress-total="importProgressTotal"
        :logs="logs"
      />

      <!-- STEP 5: SUCCESS / SUMMARY -->
      <StepSummary v-if="currentStep === 5" :import-summary="importSummary" />
    </div>

    <!-- Wizard Footer Navigation -->
    <template #footer>
      <div class="px-5 py-3 border-t border-theme-border flex justify-between items-center bg-theme-card/30 shrink-0">
        <!-- Back Button (Step 2 & 3) -->
        <button
          v-if="currentStep === 2 || currentStep === 3"
          type="button"
          @click="prevStep"
          class="px-4 py-2 border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all flex items-center gap-1 cursor-pointer mr-auto"
        >
          <ChevronLeft class="w-3.5 h-3.5" /> {{ t('importWizard.back') }}
        </button>
        <div v-else></div>

        <div class="flex items-center gap-2">
          <!-- Cancel (Step 1-3) -->
          <button
            v-if="currentStep < 4"
            type="button"
            @click="emit('close')"
            class="px-4 py-2 border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
          >
            {{ t('importWizard.cancel') }}
          </button>

          <!-- Next Button (Step 2) -->
          <button
            v-if="currentStep === 2"
            type="button"
            @click="nextToPreview"
            :disabled="!mappings.title"
            class="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-1 cursor-pointer"
          >
            {{ t('importWizard.previewTasks') }} <ChevronRight class="w-3.5 h-3.5" />
          </button>

          <!-- Start Import (Step 3) -->
          <button
            v-if="currentStep === 3"
            type="button"
            @click="runImport(() => emit('success'))"
            :disabled="selectedRows.size === 0"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-1 cursor-pointer"
          >
            {{ t('importWizard.startImport') }} <ArrowRight class="w-3.5 h-3.5" />
          </button>

          <!-- Finish Button (Step 5) -->
          <button
            v-if="currentStep === 5"
            type="button"
            @click="emit('close')"
            class="px-5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            {{ t('importWizard.done') }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
