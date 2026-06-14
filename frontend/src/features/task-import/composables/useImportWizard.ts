import { ref, computed, type Ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useProjectStore } from '@/stores/project';
import { createTask, createBucket } from '@/api';
import { read, utils } from 'xlsx';

export type Step = 1 | 2 | 3 | 4 | 5;

export interface LogEntry {
  type: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

export interface Mappings {
  title: string;
  description: string;
  bucket: string;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
  labels: string;
  checklist: string;
}

export function useImportWizard(projectId: string | Ref<string>) {
  const { t, tBucket } = useI18n();
  const projectStore = useProjectStore();

  const resolvedProjectId = computed(() => {
    return typeof projectId === 'string' ? projectId : projectId.value;
  });

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

  // Excel Column Mappings
  const mappings = ref<Mappings>({
    title: '',
    description: '',
    bucket: '',
    status: '',
    priority: '',
    startDate: '',
    dueDate: '',
    labels: '',
    checklist: '',
  });

  // Destination Column Mapping Strategy
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
  const logs = ref<LogEntry[]>([]);
  const importSummary = ref({
    success: 0,
    skipped: 0,
    failed: 0,
  });

  const isImporting = ref(false);

  const currentWorkbook = ref<any>(null);
  const sheetNames = ref<string[]>([]);
  const selectedSheetName = ref<string>('');

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
      checklist: '',
    };
    bucketStrategy.value = 'excel-bucket';
    selectedRows.value.clear();
    importProgressCurrent.value = 0;
    importProgressTotal.value = 0;
    logs.value = [];
    importSummary.value = { success: 0, skipped: 0, failed: 0 };
    isImporting.value = false;
    currentWorkbook.value = null;
    sheetNames.value = [];
    selectedSheetName.value = '';
  };

  // Auto-map Excel Headers to standard Planner fields
  const autoDetectMappings = () => {
    const findMatch = (keys: string[]) => {
      return (
        excelHeaders.value.find((header) => {
          const norm = header
            .toLowerCase()
            .replace(/ä/g, 'a')
            .replace(/ö/g, 'o')
            .replace(/ü/g, 'u')
            .replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]/g, '');
          return keys.some((k) => norm === k || norm.includes(k));
        }) || ''
      );
    };

    mappings.value.title = findMatch(['tasktitle', 'taskname', 'title', 'task name', 'aufgabenname']);
    mappings.value.description = findMatch(['description', 'notes', 'body', 'details', 'notizen', 'beschreibung']);
    mappings.value.bucket = findMatch(['bucketname', 'bucket', 'column', 'eimer']);
    mappings.value.status = findMatch(['status', 'progress', 'state']);
    mappings.value.priority = findMatch(['priority', 'prioritat', 'priorit']);
    mappings.value.startDate = findMatch(['startdate', 'start', 'startdatum']);
    mappings.value.dueDate = findMatch(['duedate', 'due', 'deadline', 'falligkeitsdatum', 'falligkeit']);
    mappings.value.labels = findMatch(['labels', 'tags', 'categories', 'bezeichnungen']);
    mappings.value.checklist = findMatch(['checklist', 'checklistitems', 'checklists', 'checklistenpunkte']);

    // Adjust Strategy based on auto-detection
    if (!mappings.value.bucket && mappings.value.status) {
      bucketStrategy.value = 'excel-status';
    } else if (!mappings.value.bucket) {
      bucketStrategy.value = 'single-column';
    }
  };

  const loadSheet = (sheetName: string) => {
    if (!currentWorkbook.value) return;

    fileError.value = null;
    try {
      const worksheet = currentWorkbook.value.Sheets[sheetName];
      if (!worksheet) {
        fileError.value = `Sheet "${sheetName}" not found.`;
        return;
      }

      const rows = utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      if (rows.length === 0) {
        fileError.value = `The selected sheet "${sheetName}" is empty.`;
        excelHeaders.value = [];
        excelRows.value = [];
        selectedRows.value.clear();
        return;
      }

      const headersSet = new Set<string>();
      rows.forEach((row) => {
        Object.keys(row).forEach((key) => headersSet.add(key));
      });

      excelHeaders.value = Array.from(headersSet);
      excelRows.value = rows;
      selectedSheetName.value = sheetName;

      selectedRows.value = new Set(excelRows.value.keys());
      autoDetectMappings();
    } catch (err: any) {
      fileError.value = `Failed to load sheet "${sheetName}": ${err.message || err}`;
    }
  };

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

      currentWorkbook.value = workbook;
      sheetNames.value = workbook.SheetNames;

      const commonSheets = ['konsolidierte daten', 'consolidated data', 'tasks', 'aufgaben', 'sheet1', 'tabelle1'];
      let bestSheetName = workbook.SheetNames[0];

      for (const name of workbook.SheetNames) {
        const normName = name.toLowerCase().trim();
        if (commonSheets.some((cs) => normName === cs || normName.includes(cs))) {
          bestSheetName = name;
          break;
        }
      }

      loadSheet(bestSheetName);

      if (excelRows.value.length > 0) {
        currentStep.value = 2;
      }
    } catch (err: any) {
      fileError.value = `Failed to read Excel file: ${err.message || err}`;
    }
  };

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

  const parseExcelDate = (val: any): string | undefined => {
    if (!val) return undefined;

    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }

    try {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Error parsing date: ' + e);
    }
    return undefined;
  };

  const parseExcelPriority = (val: any): string => {
    if (!val) return 'none';
    const norm = String(val).toLowerCase().trim();
    if (norm.includes('urgent') || norm.includes('dringend')) return 'urgent';
    if (norm.includes('high') || norm.includes('important') || norm.includes('wichtig')) return 'high';
    if (norm.includes('medium') || norm.includes('normal') || norm.includes('mittel')) return 'medium';
    if (norm.includes('low') || norm.includes('niedrig')) return 'low';
    return 'none';
  };

  const parseExcelTags = (val: any): string[] => {
    if (!val) return [];
    const parts = String(val).split(/[;,|\n]+/);
    return parts.map((p) => p.trim()).filter(Boolean);
  };

  const parseExcelChecklist = (val: any): string => {
    if (!val) return '';
    const items = String(val).split(/[;\n]+/);
    let md = '\n\n### Checklist\n';
    items.forEach((item) => {
      const clean = item.trim();
      if (clean) {
        md += `- [ ] ${clean}\n`;
      }
    });
    return md;
  };

  const getDestinationBucketInfo = (row: Record<string, any>) => {
    let bucketName;
    let isOverride = false;
    let originalBucket = '';

    if (bucketStrategy.value === 'excel-bucket' && mappings.value.bucket) {
      const excelBucketVal = String(row[mappings.value.bucket] || '').trim();
      originalBucket = excelBucketVal || 'To Do';
      bucketName = originalBucket;

      if (mappings.value.status && row[mappings.value.status]) {
        const excelStatusVal = String(row[mappings.value.status]).toLowerCase().trim();
        if (
          excelStatusVal.includes('completed') ||
          excelStatusVal.includes('done') ||
          excelStatusVal.includes('abgeschlossen') ||
          excelStatusVal.includes('erledigt')
        ) {
          bucketName = 'done';
          isOverride = true;
        }
      }
    } else if (bucketStrategy.value === 'excel-status' && mappings.value.status) {
      const excelStatusVal = String(row[mappings.value.status] || '')
        .toLowerCase()
        .trim();
      if (
        excelStatusVal.includes('completed') ||
        excelStatusVal.includes('done') ||
        excelStatusVal.includes('abgeschlossen') ||
        excelStatusVal.includes('erledigt')
      ) {
        bucketName = 'done';
      } else if (excelStatusVal.includes('progress') || excelStatusVal.includes('started') || excelStatusVal.includes('bearbeitung')) {
        bucketName = 'in-progress';
      } else {
        bucketName = 'todo';
      }
    } else {
      originalBucket = fallbackBucket.value;
      bucketName = originalBucket;
      if (mappings.value.status && row[mappings.value.status]) {
        const excelStatusVal = String(row[mappings.value.status]).toLowerCase().trim();
        if (
          excelStatusVal.includes('completed') ||
          excelStatusVal.includes('done') ||
          excelStatusVal.includes('abgeschlossen') ||
          excelStatusVal.includes('erledigt')
        ) {
          bucketName = 'done';
          isOverride = true;
        }
      }
    }

    return {
      bucketName,
      isOverride,
      originalBucket,
    };
  };

  const getBucketTitle = (name: string): string => {
    const b = projectStore.buckets.find((bucket) => bucket.name === name);
    return tBucket(name, b?.title);
  };

  const runImport = async (onSuccessCallback?: () => void) => {
    isImporting.value = true;
    currentStep.value = 4;
    logs.value = [];

    const toImportIndices = Array.from(selectedRows.value);
    importProgressTotal.value = toImportIndices.length;
    importProgressCurrent.value = 0;

    importSummary.value = { success: 0, skipped: 0, failed: 0 };

    const existingTaskTitles = new Set<string>();
    projectStore.tasks.forEach((t) => {
      existingTaskTitles.add(t.title.toLowerCase().trim());
    });

    const currentBuckets = [...projectStore.buckets];
    const bucketCache = new Map<string, string>();
    currentBuckets.forEach((b) => {
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

      try {
        logs.value.push({ type: 'info', text: `Creating custom column: "${cleanTitle}"` });
        const newB = await createBucket(resolvedProjectId.value, cleanTitle);
        bucketCache.set(lowerTitle, newB.name);
        return newB.name;
      } catch (err: any) {
        logs.value.push({ type: 'warn', text: `Failed to create column "${cleanTitle}", using default instead.` });
        console.warn(err);
        return fallbackBucket.value;
      }
    };

    const parsedTagsAppend = appendTags.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
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

      if (skipDuplicates.value && existingTaskTitles.has(rawTitle.toLowerCase())) {
        importSummary.value.skipped++;
        logs.value.push({ type: 'warn', text: `Skipped: "${rawTitle}" (Duplicate task already exists)` });
        importProgressCurrent.value++;
        continue;
      }

      let resolvedBucket;
      const info = getDestinationBucketInfo(row);

      if (bucketStrategy.value === 'excel-bucket' && mappings.value.bucket) {
        const originalBucketName = info.originalBucket || 'To Do';
        const bucketIdName = await getOrCreateBucketName(originalBucketName);

        if (info.isOverride) {
          resolvedBucket = 'done';
          logs.value.push({
            type: 'info',
            text: `Row ${idx + 1}: Status override for "${rawTitle}" - original bucket was "${originalBucketName}", placed in "done" because status is "${row[mappings.value.status]}"`,
          });
        } else {
          resolvedBucket = bucketIdName;
        }
      } else if (bucketStrategy.value === 'single-column') {
        if (info.isOverride) {
          resolvedBucket = 'done';
          logs.value.push({
            type: 'info',
            text: `Row ${idx + 1}: Status override for "${rawTitle}" - placed in "done" instead of single column "${getBucketTitle(fallbackBucket.value)}" because status is "${row[mappings.value.status]}"`,
          });
        } else {
          resolvedBucket = fallbackBucket.value;
        }
      } else {
        resolvedBucket = info.bucketName;
      }

      const priorityVal = mappings.value.priority ? parseExcelPriority(row[mappings.value.priority]) : 'none';

      const dueDateVal = mappings.value.dueDate ? parseExcelDate(row[mappings.value.dueDate]) : undefined;
      const startDateVal = mappings.value.startDate ? parseExcelDate(row[mappings.value.startDate]) : undefined;

      const rowTags = mappings.value.labels ? parseExcelTags(row[mappings.value.labels]) : [];
      const mergedTags = Array.from(new Set([...rowTags, ...parsedTagsAppend]));

      let descriptionBody = mappings.value.description ? String(row[mappings.value.description] || '').trim() : '';
      if (mappings.value.checklist && row[mappings.value.checklist]) {
        descriptionBody += parseExcelChecklist(row[mappings.value.checklist]);
      }

      try {
        await createTask(resolvedProjectId.value, {
          title: rawTitle,
          bucket: resolvedBucket,
          tags: mergedTags,
          body: descriptionBody,
          due_date: dueDateVal,
          planned_date: startDateVal,
          priority: priorityVal,
        });

        existingTaskTitles.add(rawTitle.toLowerCase());
        importSummary.value.success++;
        logs.value.push({ type: 'success', text: `Created task: "${rawTitle}"` });
      } catch (err: any) {
        importSummary.value.failed++;
        logs.value.push({ type: 'error', text: `Failed to create "${rawTitle}": ${err.message || err}` });
      }

      importProgressCurrent.value++;
    }

    await projectStore.invalidate();
    await projectStore.fetchBuckets(resolvedProjectId.value);

    isImporting.value = false;
    currentStep.value = 5;
    if (onSuccessCallback) {
      onSuccessCallback();
    }
  };

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

  return {
    currentStep,
    fileInput,
    triggerFileSelect,
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
    currentWorkbook,
    sheetNames,
    selectedSheetName,
    resetState,
    autoDetectMappings,
    loadSheet,
    processFile,
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
  };
}
