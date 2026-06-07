<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  Info,
  Settings,
  ListTodo,
  ArrowRight,
  Loader2
} from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { useProjectStore } from '@/stores/project';
import { createTask, createBucket } from '@/api';
import { read, utils } from 'xlsx';

const { t } = useI18n();
const projectStore = useProjectStore();

const props = defineProps<{
  isOpen: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

// Wizard Steps:
// 1 = Upload File
// 2 = Column Mapping & Strategy Config
// 3 = Row Preview & Selection
// 4 = Progress & Importing
// 5 = Success / Summary
type Step = 1 | 2 | 3 | 4 | 5;
const currentStep = ref<Step>(1);

// File and Parsing State
const fileInput = ref<HTMLInputElement | null>(null);
const triggerFileSelect = () => {
  fileInput.value?.click();
};

const isDragging = ref(false);
const fileName = ref('');
const fileError = ref<string | null>(null);
const excelHeaders = ref<string[]>([]);
const excelRows = ref<Record<string, any>[]>([]);

// Excel Column Mappings (mapped to standard Planner fields)
const mappings = ref({
  title: '',
  description: '',
  bucket: '',
  status: '',
  priority: '',
  startDate: '',
  dueDate: '',
  labels: '',
  checklist: ''
});

// Destination Column Mapping Strategy
// 'excel-bucket' = Create / map dynamically to Excel's "Bucket name" column
// 'excel-status' = Map task column based on status ("Not started" -> "todo", "In progress" -> "in-progress", "Completed" -> "done")
// 'single-column' = Put all tasks in a single specified Jotter column
const bucketStrategy = ref<'excel-bucket' | 'excel-status' | 'single-column'>('excel-bucket');
const fallbackBucket = ref('todo');

// Additional Import Settings
const skipDuplicates = ref(true);
const appendTags = ref('');

// Row Selection States
const selectedRows = ref<Set<number>>(new Set());

// Progress Tracking States
const importProgressCurrent = ref(0);
const importProgressTotal = ref(0);
const logs = ref<{ type: 'info' | 'success' | 'warn' | 'error'; text: string }[]>([]);
const importSummary = ref({
  success: 0,
  skipped: 0,
  failed: 0
});

const isImporting = ref(false);

// Clean up states on reset
const resetState = () => {
  currentStep.value = 1;
  fileName.value = '';
  fileError.value = null;
  excelHeaders.value = [];
  excelRows.value = [];
  mappings.value = {
    title: '',
    description: '',
    bucket: '',
    status: '',
    priority: '',
    startDate: '',
    dueDate: '',
    labels: '',
    checklist: ''
  };
  bucketStrategy.value = 'excel-bucket';
  selectedRows.value.clear();
  importProgressCurrent.value = 0;
  importProgressTotal.value = 0;
  logs.value = [];
  importSummary.value = { success: 0, skipped: 0, failed: 0 };
  isImporting.value = false;
};

// Auto-map Excel Headers to standard Planner fields
const autoDetectMappings = () => {
  const findMatch = (keys: string[]) => {
    return excelHeaders.value.find(header => {
      const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      return keys.some(k => norm === k || norm.includes(k));
    }) || '';
  };

  mappings.value.title = findMatch(['tasktitle', 'taskname', 'title', 'name']);
  mappings.value.description = findMatch(['description', 'notes', 'body', 'details']);
  mappings.value.bucket = findMatch(['bucketname', 'bucket', 'column']);
  mappings.value.status = findMatch(['status', 'progress', 'state']);
  mappings.value.priority = findMatch(['priority']);
  mappings.value.startDate = findMatch(['startdate', 'start']);
  mappings.value.dueDate = findMatch(['duedate', 'due', 'deadline']);
  mappings.value.labels = findMatch(['labels', 'tags', 'categories']);
  mappings.value.checklist = findMatch(['checklist', 'checklistitems', 'checklists']);

  // Adjust Strategy based on auto-detection
  if (!mappings.value.bucket && mappings.value.status) {
    bucketStrategy.value = 'excel-status';
  } else if (!mappings.value.bucket) {
    bucketStrategy.value = 'single-column';
  }
};

// Process Excel File Upload
const processFile = async (file: File) => {
  fileError.value = null;
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    fileError.value = t('errors.invalidFileType') || 'Only Excel files (.xlsx, .xls) are supported.';
    return;
  }

  fileName.value = file.name;
  try {
    const data = await file.arrayBuffer();
    const workbook = read(data, { type: 'array' });
    if (workbook.SheetNames.length === 0) {
      fileError.value = 'The uploaded Excel file contains no sheets.';
      return;
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Parse sheet as JSON with raw values to keep date formats
    const rows = utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    if (rows.length === 0) {
      fileError.value = 'The Excel file is empty.';
      return;
    }

    // Get all unique headers from rows
    const headersSet = new Set<string>();
    rows.forEach(row => {
      Object.keys(row).forEach(key => headersSet.add(key));
    });

    excelHeaders.value = Array.from(headersSet);
    excelRows.value = rows;

    // Reset row selection (select all by default)
    selectedRows.value = new Set(excelRows.value.keys());

    // Run auto-mapping
    autoDetectMappings();

    // Advance to Step 2
    currentStep.value = 2;
  } catch (err: any) {
    fileError.value = `Failed to read Excel file: ${err.message || err}`;
  }
};

// Drag and Drop event handlers
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    processFile(e.dataTransfer.files[0]);
  }
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processFile(target.files[0]);
  }
};

// Pre-fill / Fallback values logic
const availableBuckets = computed(() => projectStore.buckets);

const nextToPreview = () => {
  if (!mappings.value.title) {
    fileError.value = 'Task Title is a required mapping.';
    return;
  }
  fileError.value = null;
  currentStep.value = 3;
};

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value = (currentStep.value - 1) as Step;
  }
};

// Formatting Helper Functions
const parseExcelDate = (val: any): string | undefined => {
  if (!val) return undefined;
  
  // SheetJS sometimes imports dates as numbers (days since 1900)
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }

  // Parse standard string formats
  try {
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {}
  return undefined;
};

const parseExcelPriority = (val: any): string => {
  if (!val) return 'none';
  const norm = String(val).toLowerCase().trim();
  if (norm.includes('urgent')) return 'urgent';
  if (norm.includes('high') || norm.includes('important')) return 'high';
  if (norm.includes('medium') || norm.includes('normal')) return 'medium';
  if (norm.includes('low')) return 'low';
  return 'none';
};

const parseExcelTags = (val: any): string[] => {
  if (!val) return [];
  // Split on semicolons, commas, or newlines
  const parts = String(val).split(/[;,|\n]+/);
  return parts
    .map(p => p.trim())
    .filter(Boolean);
};

const parseExcelChecklist = (val: any): string => {
  if (!val) return '';
  // Split on semicolons, commas, or newlines
  const items = String(val).split(/[;\n]+/);
  let md = '\n\n### Checklist\n';
  items.forEach(item => {
    const clean = item.trim();
    if (clean) {
      md += `- [ ] ${clean}\n`;
    }
  });
  return md;
};

// Main Run Import Routine
const runImport = async () => {
  isImporting.value = true;
  currentStep.value = 4;
  logs.value = [];
  
  const toImportIndices = Array.from(selectedRows.value);
  importProgressTotal.value = toImportIndices.length;
  importProgressCurrent.value = 0;
  
  importSummary.value = { success: 0, skipped: 0, failed: 0 };
  
  // Cache current tasks to prevent duplicates quickly
  const existingTaskTitles = new Set<string>();
  projectStore.tasks.forEach(t => {
    existingTaskTitles.add(t.title.toLowerCase().trim());
  });

  // Keep a map of buckets to avoid redundant fetch calls
  let currentBuckets = [...projectStore.buckets];
  const bucketCache = new Map<string, string>();
  currentBuckets.forEach(b => {
    bucketCache.set(b.title.toLowerCase().trim(), b.name);
    bucketCache.set(b.name.toLowerCase().trim(), b.name);
  });

  const getOrCreateBucketName = async (title: string): Promise<string> => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return fallbackBucket.value;

    const lowerTitle = cleanTitle.toLowerCase();
    if (bucketCache.has(lowerTitle)) {
      return bucketCache.get(lowerTitle)!;
    }

    // Bucket doesn't exist, create it dynamically
    try {
      logs.value.push({ type: 'info', text: `Creating custom column: "${cleanTitle}"` });
      const newB = await createBucket(props.projectId, cleanTitle);
      bucketCache.set(lowerTitle, newB.name);
      return newB.name;
    } catch (err: any) {
      logs.value.push({ type: 'warn', text: `Failed to create column "${cleanTitle}", using default instead.` });
      return fallbackBucket.value;
    }
  };

  const parsedTagsAppend = appendTags.value
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  for (const idx of toImportIndices) {
    const row = excelRows.value[idx];
    const rawTitle = String(row[mappings.value.title] || '').trim();
    
    if (!rawTitle) {
      importSummary.value.failed++;
      logs.value.push({ type: 'error', text: `Row ${idx + 1}: Skipped (Empty task title)` });
      importProgressCurrent.value++;
      continue;
    }

    // Duplicate Check
    if (skipDuplicates.value && existingTaskTitles.has(rawTitle.toLowerCase())) {
      importSummary.value.skipped++;
      logs.value.push({ type: 'warn', text: `Skipped: "${rawTitle}" (Duplicate task already exists)` });
      importProgressCurrent.value++;
      continue;
    }

    // Resolve Bucket name based on selection strategy
    let resolvedBucket = fallbackBucket.value;
    
    if (bucketStrategy.value === 'excel-bucket' && mappings.value.bucket) {
      const excelBucketVal = String(row[mappings.value.bucket] || '').trim();
      resolvedBucket = await getOrCreateBucketName(excelBucketVal || 'To Do');
    } else if (bucketStrategy.value === 'excel-status' && mappings.value.status) {
      const excelStatusVal = String(row[mappings.value.status] || '').toLowerCase().trim();
      if (excelStatusVal.includes('completed') || excelStatusVal.includes('done')) {
        resolvedBucket = 'done';
      } else if (excelStatusVal.includes('progress') || excelStatusVal.includes('started')) {
        resolvedBucket = 'in-progress';
      } else {
        resolvedBucket = 'todo';
      }
    }

    // Resolve priority
    const priorityVal = mappings.value.priority ? parseExcelPriority(row[mappings.value.priority]) : 'none';
    
    // Resolve Dates
    const dueDateVal = mappings.value.dueDate ? parseExcelDate(row[mappings.value.dueDate]) : undefined;
    const startDateVal = mappings.value.startDate ? parseExcelDate(row[mappings.value.startDate]) : undefined;

    // Resolve Tags (Labels)
    const rowTags = mappings.value.labels ? parseExcelTags(row[mappings.value.labels]) : [];
    const mergedTags = Array.from(new Set([...rowTags, ...parsedTagsAppend]));

    // Resolve body description & checklist
    let descriptionBody = mappings.value.description ? String(row[mappings.value.description] || '').trim() : '';
    if (mappings.value.checklist && row[mappings.value.checklist]) {
      descriptionBody += parseExcelChecklist(row[mappings.value.checklist]);
    }

    // Call creation endpoint
    try {
      await createTask(props.projectId, {
        title: rawTitle,
        bucket: resolvedBucket,
        tags: mergedTags,
        body: descriptionBody,
        due_date: dueDateVal,
        planned_date: startDateVal, // map Planner's start date to Jotter's planned_date
        priority: priorityVal
      });

      // Track duplicate prevention list dynamically during runtime import
      existingTaskTitles.add(rawTitle.toLowerCase());
      
      importSummary.value.success++;
      logs.value.push({ type: 'success', text: `Created task: "${rawTitle}"` });
    } catch (err: any) {
      importSummary.value.failed++;
      logs.value.push({ type: 'error', text: `Failed to create "${rawTitle}": ${err.message || err}` });
    }

    importProgressCurrent.value++;
  }

  // Reload board / project store
  await projectStore.invalidate();
  await projectStore.fetchBuckets(props.projectId);
  
  isImporting.value = false;
  currentStep.value = 5;
  emit('success');
};

// Selection Toggle Helpers
const toggleRow = (idx: number) => {
  if (selectedRows.value.has(idx)) {
    selectedRows.value.delete(idx);
  } else {
    selectedRows.value.add(idx);
  }
};

const toggleSelectAll = () => {
  if (selectedRows.value.size === excelRows.value.length) {
    selectedRows.value.clear();
  } else {
    selectedRows.value = new Set(excelRows.value.keys());
  }
};

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

watch(() => props.isOpen, (newVal) => {
  if (newVal) resetState();
});
</script>

<template>
  <transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="!isImporting && emit('close')"></div>

      <!-- Modal Container -->
      <div class="relative bg-theme-base border border-theme-border w-full max-w-2xl rounded shadow-2xl overflow-hidden flex flex-col z-10 transition-all max-h-[85vh]">
        
        <!-- Header -->
        <div class="px-5 py-4 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
          <div class="flex items-center gap-2">
            <FileSpreadsheet class="w-5 h-5 text-emerald-500" />
            <div>
              <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">
                Import from Microsoft Planner
              </h3>
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
          
          <!-- ========================================================= -->
          <!-- STEP 1: UPLOAD FILE -->
          <!-- ========================================================= -->
          <div v-if="currentStep === 1" class="space-y-4">
            <div
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
              class="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none"
              :class="[
                isDragging 
                  ? 'border-theme-primary bg-theme-primary/5 scale-[0.99] shadow-inner' 
                  : 'border-theme-border hover:border-theme-primary/60 hover:bg-theme-column/10'
              ]"
              @click="triggerFileSelect"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".xlsx,.xls"
                class="hidden"
                @change="handleFileSelect"
              />
              <div class="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-500">
                <Upload class="w-7 h-7" :class="{ 'animate-bounce': isDragging }" />
              </div>
              <p class="text-sm font-semibold text-theme-text-main">
                Drag & drop your Planner Excel file here
              </p>
              <p class="text-xs text-theme-text-muted mt-1 max-w-sm">
                Only standard Microsoft Planner `.xlsx` spreadsheets exported via 'Export plan to Excel' are accepted.
              </p>
              <span class="mt-4 px-3 py-1.5 bg-theme-card border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary transition-all">
                Browse Files
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
                <h4 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">How to export from MS Planner:</h4>
                <p class="text-[11px] text-theme-text-muted leading-relaxed">
                  Open Microsoft Planner in your browser, select your plan, click the <span class="font-bold text-theme-text-main">"..." (More)</span> option next to "Schedule" in the header, and select <span class="font-bold text-theme-text-main">"Export plan to Excel"</span>.
                </p>
              </div>
            </div>
          </div>

          <!-- ========================================================= -->
          <!-- STEP 2: COLUMN MAPPING & STRATEGY -->
          <!-- ========================================================= -->
          <div v-if="currentStep === 2" class="space-y-5">
            <div class="p-3 bg-theme-card/50 border border-theme-border rounded flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FileSpreadsheet class="w-4 h-4 text-theme-accent" />
                <span class="text-xs font-bold text-theme-text-main font-mono">{{ fileName }}</span>
              </div>
              <span class="text-[11px] px-2 py-0.5 bg-theme-primary/10 border border-theme-primary/15 text-theme-accent rounded font-semibold">
                {{ excelRows.length }} rows detected
              </span>
            </div>

            <div class="space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-theme-text-muted flex items-center gap-1.5">
                <Settings class="w-3.5 h-3.5" /> Configure Field Mappings
              </h4>
              <p class="text-xs text-theme-text-muted">
                Match Planner spreadsheet column headers with Jotter task attributes. We have pre-mapped matches for you.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-theme-border bg-theme-card/20 rounded-lg p-4">
                <!-- Task Title Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Task Title <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="mappings.title"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="" disabled>Select Column...</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Description Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Notes & Description
                  </label>
                  <select
                    v-model="mappings.description"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Bucket Name Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Bucket Name (Columns)
                  </label>
                  <select
                    v-model="mappings.bucket"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Status Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Status (Progress)
                  </label>
                  <select
                    v-model="mappings.status"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Priority Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Priority
                  </label>
                  <select
                    v-model="mappings.priority"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Labels Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Labels (Tags)
                  </label>
                  <select
                    v-model="mappings.labels"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Start Date Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Start Date
                  </label>
                  <select
                    v-model="mappings.startDate"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Due Date Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Due Date
                  </label>
                  <select
                    v-model="mappings.dueDate"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>

                <!-- Checklist Mapping -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Checklist Items
                  </label>
                  <select
                    v-model="mappings.checklist"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">-- Skip Field --</option>
                    <option v-for="h in excelHeaders" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Strategy & Settings -->
            <div class="space-y-4">
              <h4 class="text-xs font-bold uppercase tracking-wider text-theme-text-muted flex items-center gap-1.5">
                <ListTodo class="w-3.5 h-3.5" /> Destination Strategy
              </h4>

              <div class="border border-theme-border bg-theme-card/20 rounded-lg p-4 space-y-4">
                <!-- Radio Strategies -->
                <div class="space-y-2.5">
                  <label class="flex items-start gap-2.5 cursor-pointer">
                    <input
                      v-model="bucketStrategy"
                      type="radio"
                      value="excel-bucket"
                      :disabled="!mappings.bucket"
                      class="mt-1"
                    />
                    <div>
                      <span class="text-xs font-bold text-theme-text-main block">Use Excel's Bucket Name column</span>
                      <span class="text-[10.5px] text-theme-text-muted leading-tight block">
                        Tasks are created inside columns named after their Excel bucket. Missing columns will be created automatically.
                      </span>
                    </div>
                  </label>

                  <label class="flex items-start gap-2.5 cursor-pointer">
                    <input
                      v-model="bucketStrategy"
                      type="radio"
                      value="excel-status"
                      :disabled="!mappings.status"
                      class="mt-1"
                    />
                    <div>
                      <span class="text-xs font-bold text-theme-text-main block">Map by Progress Status</span>
                      <span class="text-[10.5px] text-theme-text-muted leading-tight block">
                        Maps Tasks to standard "To Do", "In Progress", or "Done" columns based on task's progress state.
                      </span>
                    </div>
                  </label>

                  <label class="flex items-start gap-2.5 cursor-pointer">
                    <input v-model="bucketStrategy" type="radio" value="single-column" class="mt-1" />
                    <div>
                      <span class="text-xs font-bold text-theme-text-main block">Place all in a single column</span>
                      <span class="text-[10.5px] text-theme-text-muted leading-tight block">
                        Bypasses sorting and imports all tasks into one specific selected column below.
                      </span>
                    </div>
                  </label>
                </div>

                <!-- Fallback Column Selector -->
                <div class="flex items-center gap-3 pt-2 border-t border-theme-border/50">
                  <span class="text-xs text-theme-text-muted shrink-0">Fallback Column:</span>
                  <select
                    v-model="fallbackBucket"
                    class="bg-theme-card border border-theme-border rounded px-2.5 py-1 text-xs text-theme-text-input focus:outline-none"
                  >
                    <option v-for="b in availableBuckets" :key="b.name" :value="b.name">
                      {{ b.title }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Options -->
              <div class="border border-theme-border bg-theme-card/20 rounded-lg p-4 space-y-3.5">
                <!-- Prevent Duplicates Checkbox -->
                <label class="flex items-center gap-2.5 cursor-pointer">
                  <input v-model="skipDuplicates" type="checkbox" class="rounded text-theme-primary" />
                  <div>
                    <span class="text-xs font-bold text-theme-text-main block">Skip existing duplicate titles</span>
                    <span class="text-[10.5px] text-theme-text-muted block">Prevents duplicate tasks if a task with the exact title already exists in this project.</span>
                  </div>
                </label>

                <!-- Append Extra Tags -->
                <div>
                  <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
                    Append tags to all imported tasks (comma-separated)
                  </label>
                  <input
                    v-model="appendTags"
                    type="text"
                    placeholder="e.g. planner-import, 2026-q3"
                    class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- ========================================================= -->
          <!-- STEP 3: PREVIEW & SELECTION -->
          <!-- ========================================================= -->
          <div v-if="currentStep === 3" class="space-y-4">
            <div class="flex justify-between items-center bg-theme-card/30 border border-theme-border/60 rounded px-4 py-2 text-xs">
              <span class="text-theme-text-muted">
                Selected <span class="font-bold text-theme-text-main">{{ selectedRows.size }}</span> of <span class="font-bold text-theme-text-main">{{ excelRows.length }}</span> tasks
              </span>
              <button
                @click="toggleSelectAll"
                class="text-theme-primary hover:text-theme-primary-hover font-semibold transition-colors cursor-pointer"
              >
                {{ selectedRows.size === excelRows.length ? 'Deselect All' : 'Select All' }}
              </button>
            </div>

            <div class="border border-theme-border rounded-lg overflow-hidden max-h-[350px] overflow-y-auto scroller-thin">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-theme-card/50 border-b border-theme-border sticky top-0">
                  <tr>
                    <th class="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        :checked="selectedRows.size === excelRows.length"
                        @change="toggleSelectAll"
                        class="rounded"
                      />
                    </th>
                    <th class="p-3 font-semibold text-theme-text-muted">Title</th>
                    <th class="p-3 font-semibold text-theme-text-muted">Dest. Column / Status</th>
                    <th class="p-3 font-semibold text-theme-text-muted">Priority</th>
                    <th class="p-3 font-semibold text-theme-text-muted">Due Date</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-theme-border/40">
                  <tr
                    v-for="(row, idx) in excelRows"
                    :key="idx"
                    class="hover:bg-theme-column/10 cursor-pointer transition-colors"
                    @click="toggleRow(idx)"
                  >
                    <td class="p-3 text-center" @click.stop>
                      <input
                        type="checkbox"
                        :checked="selectedRows.has(idx)"
                        @change="toggleRow(idx)"
                        class="rounded"
                      />
                    </td>
                    <td class="p-3 font-semibold text-theme-text-main max-w-xs truncate" :title="row[mappings.title]">
                      {{ row[mappings.title] || '(Empty)' }}
                    </td>
                    <td class="p-3 text-theme-text-muted font-mono text-[11px]">
                      <span v-if="bucketStrategy === 'excel-bucket' && mappings.bucket" class="truncate block">
                        {{ row[mappings.bucket] || 'To Do' }}
                      </span>
                      <span v-else-if="bucketStrategy === 'excel-status' && mappings.status" class="capitalize block">
                        {{ row[mappings.status] || 'Not started' }}
                      </span>
                      <span v-else class="text-theme-text-muted italic">
                        Fallback Column
                      </span>
                    </td>
                    <td class="p-3 text-theme-text-muted">
                      <span class="capitalize">{{ parseExcelPriority(row[mappings.priority]) }}</span>
                    </td>
                    <td class="p-3 text-theme-text-muted font-mono text-[11px]">
                      {{ parseExcelDate(row[mappings.dueDate]) || '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- ========================================================= -->
          <!-- STEP 4: IMPORTING PROGRESS -->
          <!-- ========================================================= -->
          <div v-if="currentStep === 4" class="space-y-6 py-6 text-center">
            <div class="flex flex-col items-center">
              <Loader2 class="w-10 h-10 text-theme-primary animate-spin mb-4" />
              <h4 class="text-sm font-bold text-theme-text-main">
                Importing Tasks...
              </h4>
              <p class="text-xs text-theme-text-muted mt-1">
                Please wait while we parse Excel files and write local Markdown entries.
              </p>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-2">
              <div class="flex justify-between text-xs font-mono text-theme-text-muted">
                <span>Progress</span>
                <span>{{ importProgressCurrent }} / {{ importProgressTotal }} ({{ Math.round((importProgressCurrent / importProgressTotal) * 100) }}%)</span>
              </div>
              <div class="w-full bg-theme-column/30 rounded-full h-2 overflow-hidden border border-theme-border/50">
                <div
                  class="bg-theme-primary h-full rounded-full transition-all duration-300"
                  :style="{ width: `${(importProgressCurrent / importProgressTotal) * 100}%` }"
                ></div>
              </div>
            </div>

            <!-- Logs / Output -->
            <div class="text-left space-y-1 bg-slate-950 p-4 rounded font-mono text-[10.5px] h-44 overflow-y-auto border border-theme-border/30 scroller-thin">
              <div
                v-for="(log, idx) in logs"
                :key="idx"
                :class="{
                  'text-emerald-400': log.type === 'success',
                  'text-yellow-400': log.type === 'warn',
                  'text-red-400': log.type === 'error',
                  'text-sky-400': log.type === 'info'
                }"
              >
                &gt; {{ log.text }}
              </div>
            </div>
          </div>

          <!-- ========================================================= -->
          <!-- STEP 5: SUCCESS / SUMMARY -->
          <!-- ========================================================= -->
          <div v-if="currentStep === 5" class="space-y-6 py-6 text-center">
            <div class="flex flex-col items-center">
              <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <CheckCircle2 class="w-8 h-8" />
              </div>
              <h4 class="text-sm font-bold text-theme-text-main">
                Import Completed!
              </h4>
              <p class="text-xs text-theme-text-muted mt-1">
                Tasks have been parsed and synced to Jotter's local markdown repository.
              </p>
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
              Jotter indexing automatically rebuilt the local index. Your new tasks will immediately appear on the Kanban board and in the schedule views.
            </p>
          </div>

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
            @click="runImport"
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
