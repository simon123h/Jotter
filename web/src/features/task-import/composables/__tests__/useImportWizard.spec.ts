import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useImportWizard } from '../useImportWizard';

// Mock the API layer to prevent network requests
vi.mock('@/api', () => ({
  createTask: vi.fn().mockResolvedValue({}),
  createBucket: vi.fn().mockResolvedValue({ name: 'custom-bucket' }),
}));

describe('useImportWizard Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initializes with correct default wizard states', () => {
    const wizard = useImportWizard('test-project');

    expect(wizard.currentStep.value).toBe(1);
    expect(wizard.fileName.value).toBe('');
    expect(wizard.fileError.value).toBeNull();
    expect(wizard.excelHeaders.value).toEqual([]);
    expect(wizard.excelRows.value).toEqual([]);
    expect(wizard.bucketStrategy.value).toBe('excel-bucket');
    expect(wizard.selectedRows.value.size).toBe(0);
    expect(wizard.isImporting.value).toBe(false);
  });

  it('resets wizard states correctly on resetState()', () => {
    const wizard = useImportWizard('test-project');

    // Mutate some states
    wizard.currentStep.value = 3;
    wizard.fileName.value = 'my-planner-tasks.xlsx';
    wizard.fileError.value = 'Some loading error';
    wizard.excelHeaders.value = ['Task Name', 'Bucket'];
    wizard.excelRows.value = [{ 'Task Name': 'Hello' }];
    wizard.selectedRows.value.add(0);
    wizard.isImporting.value = true;

    // Call reset
    wizard.resetState();

    expect(wizard.currentStep.value).toBe(1);
    expect(wizard.fileName.value).toBe('');
    expect(wizard.fileError.value).toBeNull();
    expect(wizard.excelHeaders.value).toEqual([]);
    expect(wizard.excelRows.value).toEqual([]);
    expect(wizard.bucketStrategy.value).toBe('excel-bucket');
    expect(wizard.selectedRows.value.size).toBe(0);
    expect(wizard.isImporting.value).toBe(false);
  });

  it('parses Excel dates correctly', () => {
    const wizard = useImportWizard('test-project');

    // Null/undefined inputs
    expect(wizard.parseExcelDate(null)).toBeUndefined();
    expect(wizard.parseExcelDate('')).toBeUndefined();

    // 45450 represents June 7, 2024
    expect(wizard.parseExcelDate(45450)).toBe('2024-06-07');

    // Standard string dates
    expect(wizard.parseExcelDate('2026-06-14')).toBe('2026-06-14');
    expect(wizard.parseExcelDate('2026-06-14T12:00:00.000Z')).toBe('2026-06-14');
  });

  it('parses Excel priority fields correctly', () => {
    const wizard = useImportWizard('test-project');

    // English priorities
    expect(wizard.parseExcelPriority('Urgent')).toBe('urgent');
    expect(wizard.parseExcelPriority('High')).toBe('high');
    expect(wizard.parseExcelPriority('Important')).toBe('high');
    expect(wizard.parseExcelPriority('Medium')).toBe('medium');
    expect(wizard.parseExcelPriority('Normal')).toBe('medium');
    expect(wizard.parseExcelPriority('Low')).toBe('low');

    // German priorities
    expect(wizard.parseExcelPriority('Dringend')).toBe('urgent');
    expect(wizard.parseExcelPriority('Wichtig')).toBe('high');
    expect(wizard.parseExcelPriority('Mittel')).toBe('medium');
    expect(wizard.parseExcelPriority('Niedrig')).toBe('low');

    // Default priority
    expect(wizard.parseExcelPriority(null)).toBe('none');
    expect(wizard.parseExcelPriority('some invalid priority')).toBe('none');
  });

  it('manages row selections correctly', () => {
    const wizard = useImportWizard('test-project');
    wizard.excelRows.value = [{ Title: 'Task 1' }, { Title: 'Task 2' }, { Title: 'Task 3' }];

    // Toggle individual row selections
    wizard.toggleRow(1);
    expect(wizard.selectedRows.value.has(1)).toBe(true);
    expect(wizard.selectedRows.value.size).toBe(1);

    wizard.toggleRow(1);
    expect(wizard.selectedRows.value.has(1)).toBe(false);
    expect(wizard.selectedRows.value.size).toBe(0);

    // Toggle select all
    wizard.toggleSelectAll();
    expect(wizard.selectedRows.value.size).toBe(3);
    expect(wizard.selectedRows.value.has(0)).toBe(true);
    expect(wizard.selectedRows.value.has(1)).toBe(true);
    expect(wizard.selectedRows.value.has(2)).toBe(true);

    wizard.toggleSelectAll();
    expect(wizard.selectedRows.value.size).toBe(0);
  });

  it('resolves correct destination buckets and overrides', () => {
    const wizard = useImportWizard('test-project');

    // Initialize mapping keys
    wizard.mappings.value.bucket = 'Bucket Column';
    wizard.mappings.value.status = 'Progress Column';
    wizard.bucketStrategy.value = 'excel-bucket';

    // Scenario 1: Basic Bucket matching with no overrides
    const row1 = {
      'Bucket Column': 'Marketing',
      'Progress Column': 'Not Started',
    };
    const info1 = wizard.getDestinationBucketInfo(row1);
    expect(info1.bucketName).toBe('Marketing');
    expect(info1.isOverride).toBe(false);
    expect(info1.originalBucket).toBe('Marketing');

    // Scenario 2: Done override based on completion status (English and German variants)
    const row2 = {
      'Bucket Column': 'Development',
      'Progress Column': 'Completed',
    };
    const info2 = wizard.getDestinationBucketInfo(row2);
    expect(info2.bucketName).toBe('done');
    expect(info2.isOverride).toBe(true);
    expect(info2.originalBucket).toBe('Development');

    const row3 = {
      'Bucket Column': 'Development',
      'Progress Column': 'Erledigt',
    };
    const info3 = wizard.getDestinationBucketInfo(row3);
    expect(info3.bucketName).toBe('done');
    expect(info3.isOverride).toBe(true);

    // Scenario 3: Strategy 'excel-status'
    wizard.bucketStrategy.value = 'excel-status';
    const row4 = {
      'Progress Column': 'In Progress',
    };
    const info4 = wizard.getDestinationBucketInfo(row4);
    expect(info4.bucketName).toBe('in-progress');

    const row5 = {
      'Progress Column': 'Completed',
    };
    const info5 = wizard.getDestinationBucketInfo(row5);
    expect(info5.bucketName).toBe('done');

    const row6 = {
      'Progress Column': 'Not Active',
    };
    const info6 = wizard.getDestinationBucketInfo(row6);
    expect(info6.bucketName).toBe('todo');

    // Scenario 4: Strategy 'single-column'
    wizard.bucketStrategy.value = 'single-column';
    wizard.fallbackBucket.value = 'in-progress';
    const row7 = {
      'Progress Column': 'Not Started',
    };
    const info7 = wizard.getDestinationBucketInfo(row7);
    expect(info7.bucketName).toBe('in-progress');
  });

  it('detects header mappings automatically', () => {
    const wizard = useImportWizard('test-project');

    wizard.excelHeaders.value = ['Aufgabenname', 'Beschreibung', 'Eimer', 'Priorität', 'Deadline', 'Tags', 'Checklist'];

    wizard.autoDetectMappings();

    expect(wizard.mappings.value.title).toBe('Aufgabenname');
    expect(wizard.mappings.value.description).toBe('Beschreibung');
    expect(wizard.mappings.value.bucket).toBe('Eimer');
    expect(wizard.mappings.value.priority).toBe('Priorität');
    expect(wizard.mappings.value.dueDate).toBe('Deadline');
    expect(wizard.mappings.value.labels).toBe('Tags');
    expect(wizard.mappings.value.checklist).toBe('Checklist');
  });

  it('detects general and CSV keywords automatically', () => {
    const wizard = useImportWizard('test-project');

    wizard.excelHeaders.value = ['Subject', 'Text', 'Category', 'Keywords'];

    wizard.autoDetectMappings();

    expect(wizard.mappings.value.title).toBe('Subject');
    expect(wizard.mappings.value.description).toBe('Text');
    expect(wizard.mappings.value.bucket).toBe('Category');
    expect(wizard.mappings.value.labels).toBe('Keywords');
  });

  it('validates required title before proceeding to preview', () => {
    const wizard = useImportWizard('test-project');

    // Missing title mapping
    wizard.mappings.value.title = '';
    wizard.nextToPreview();
    expect(wizard.fileError.value).toContain('required');
    expect(wizard.currentStep.value).toBe(1);

    // Title mapped
    wizard.mappings.value.title = 'Title Col';
    wizard.nextToPreview();
    expect(wizard.fileError.value).toBeNull();
    expect(wizard.currentStep.value).toBe(3);
  });

  it('runs the import process successfully', async () => {
    const wizard = useImportWizard('test-project');
    const { useProjectStore } = await import('@/stores/project');
    const store = useProjectStore();
    store.buckets = [{ name: 'todo', title: 'To Do' }] as any;
    store.tasks = [];

    // Stub store methods
    store.invalidate = vi.fn().mockResolvedValue(undefined);
    store.fetchBuckets = vi.fn().mockResolvedValue(undefined);

    wizard.excelRows.value = [
      {
        'Task Name': 'Task A',
        'Bucket Col': 'todo',
        'Priority Col': 'High',
        'Label Col': 'bug',
      },
    ];
    wizard.mappings.value.title = 'Task Name';
    wizard.mappings.value.bucket = 'Bucket Col';
    wizard.mappings.value.priority = 'Priority Col';
    wizard.mappings.value.labels = 'Label Col';

    wizard.selectedRows.value.add(0);

    const successCallback = vi.fn();
    await wizard.runImport(successCallback);

    expect(wizard.importSummary.value.success).toBe(1);
    expect(wizard.importSummary.value.failed).toBe(0);
    expect(wizard.currentStep.value).toBe(5);
    expect(successCallback).toHaveBeenCalled();
  });
});
