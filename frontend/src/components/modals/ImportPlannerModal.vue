<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { X, FileSpreadsheet, ChevronRight, ChevronLeft, ArrowRight } from '@lucide/vue';
import { useImportWizard } from '@/features/task-import/composables/useImportWizard';
import StepUpload from '@/features/task-import/components/StepUpload.vue';
import StepColumnMapper from '@/features/task-import/components/StepColumnMapper.vue';
import StepRowPreview from '@/features/task-import/components/StepRowPreview.vue';
import StepProgress from '@/features/task-import/components/StepProgress.vue';
import StepSummary from '@/features/task-import/components/StepSummary.vue';

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

// Escape Key Closes Modal
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen && !isImporting.value) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  if (props.isOpen) resetState();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) resetState();
  }
);
</script>

<template>
  <transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="!isImporting && emit('close')"></div>

      <!-- Modal Container -->
      <div
        class="relative bg-theme-base border border-theme-border w-full max-w-2xl rounded shadow-2xl overflow-hidden flex flex-col z-10 transition-all max-h-[85vh]"
      >
        <!-- Header -->
        <div class="px-5 py-4 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
          <div class="flex items-center gap-2">
            <FileSpreadsheet class="w-5 h-5 text-emerald-500" />
            <div>
              <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">Import from Microsoft Planner</h3>
              <p class="text-[11px] text-theme-text-muted">Import tasks directly from exported Planner Excel sheets.</p>
            </div>
          </div>
          <button
            v-if="!isImporting"
            @click="emit('close')"
            class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1.5 hover:bg-theme-card rounded cursor-pointer"
          >
            <X class="w-4 h-4 shrink-0" />
          </button>
        </div>

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

        <!-- Footer Buttons -->
        <div class="px-5 py-3.5 border-t border-theme-border flex justify-end gap-2 bg-theme-card/30">
          <!-- Cancel / Close (Visible during Steps 1-3) -->
          <button
            v-if="currentStep <= 3"
            type="button"
            @click="emit('close')"
            class="px-4 py-2 border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
          >
            Cancel
          </button>

          <!-- Back Button (Step 2 & 3) -->
          <button
            v-if="currentStep === 2 || currentStep === 3"
            type="button"
            @click="prevStep"
            class="px-4 py-2 border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all flex items-center gap-1 cursor-pointer mr-auto"
          >
            <ChevronLeft class="w-3.5 h-3.5" /> Back
          </button>

          <!-- Next Button (Step 2) -->
          <button
            v-if="currentStep === 2"
            type="button"
            @click="nextToPreview"
            class="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-1 cursor-pointer"
          >
            Preview Tasks <ChevronRight class="w-3.5 h-3.5" />
          </button>

          <!-- Start Import (Step 3) -->
          <button
            v-if="currentStep === 3"
            type="button"
            @click="runImport(() => emit('success'))"
            :disabled="selectedRows.size === 0"
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-1 cursor-pointer"
          >
            Start Import <ArrowRight class="w-3.5 h-3.5" />
          </button>

          <!-- Finish Button (Step 5) -->
          <button
            v-if="currentStep === 5"
            type="button"
            @click="emit('close')"
            class="px-5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.96);
}
</style>
