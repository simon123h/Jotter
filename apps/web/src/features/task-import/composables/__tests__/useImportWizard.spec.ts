import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { utils, write } from 'xlsx';
import { createBucket, createTask } from '@/api';
import { useProjectStore } from '@/stores/project';
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

describe('useImportWizard: reading a file', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  /** A file as the browser hands it over; jsdom has no File.arrayBuffer. */
  const fileOf = (name: string, content: string | ArrayBuffer) =>
    ({
      name,
      arrayBuffer: async () => (typeof content === 'string' ? new TextEncoder().encode(content).buffer : content),
    }) as unknown as File;
  const xlsxOf = (sheets: Record<string, unknown[][]>) => {
    const workbook = utils.book_new();
    for (const [name, rows] of Object.entries(sheets)) utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), name);
    return write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  };

  it('reads a CSV file, selects every row, guesses the mappings and moves on', async () => {
    const wizard = useImportWizard('p');
    await wizard.processFile(
      fileOf('tasks.csv', 'Task Name,Status,Due Date,Labels\nWrite report,Done,2026-10-20,work\nCall Pia,Open,,home\n')
    );

    expect(wizard.fileError.value).toBeNull();
    expect(wizard.fileName.value).toBe('tasks.csv');
    expect(wizard.excelHeaders.value).toEqual(['Task Name', 'Status', 'Due Date', 'Labels']);
    expect(wizard.excelRows.value).toHaveLength(2);
    expect([...wizard.selectedRows.value]).toEqual([0, 1]);
    expect(wizard.mappings.value).toMatchObject({ title: 'Task Name', status: 'Status', dueDate: 'Due Date', labels: 'Labels' });
    expect(wizard.bucketStrategy.value).toBe('excel-status');
    expect(wizard.currentStep.value).toBe(2);
  });

  it('refuses other file types, and an empty file', async () => {
    const wizard = useImportWizard('p');
    await wizard.processFile(fileOf('notes.txt', 'hello'));
    expect(wizard.fileError.value).toContain('Excel');
    expect(wizard.currentStep.value).toBe(1);

    await wizard.processFile(fileOf('empty.csv', ''));
    expect(wizard.fileError.value).toContain('empty');
    expect(wizard.currentStep.value).toBe(1);
  });

  it('opens the sheet that looks like the task list, and can switch to another', async () => {
    const wizard = useImportWizard('p');
    await wizard.processFile(
      fileOf(
        'book.xlsx',
        xlsxOf({
          Cover: [['Title'], ['Plan']],
          Tasks: [
            ['Title', 'Bucket'],
            ['Pack bags', 'Trip'],
          ],
          Other: [['Name'], ['x']],
        })
      )
    );

    expect(wizard.sheetNames.value).toEqual(['Cover', 'Tasks', 'Other']);
    expect(wizard.selectedSheetName.value).toBe('Tasks');
    expect(wizard.excelRows.value).toEqual([{ Title: 'Pack bags', Bucket: 'Trip' }]);
    expect(wizard.mappings.value).toMatchObject({ title: 'Title', bucket: 'Bucket' });

    await wizard.loadSheet('Other');
    expect(wizard.excelHeaders.value).toEqual(['Name']);
    expect(wizard.selectedSheetName.value).toBe('Other');

    await wizard.loadSheet('Missing');
    expect(wizard.fileError.value).toContain('not found');
  });

  it('reports a file it cannot read', async () => {
    const wizard = useImportWizard('p');
    await wizard.processFile({ name: 'broken.xlsx', arrayBuffer: async () => Promise.reject(new Error('disk gone')) } as unknown as File);
    expect(wizard.fileError.value).toContain('disk gone');
  });

  it('takes files that are dropped or chosen, and shows the drop zone while one is dragged over', async () => {
    const wizard = useImportWizard('p');
    const prevent = vi.fn();
    wizard.handleDragOver({ preventDefault: prevent } as unknown as DragEvent);
    expect(wizard.isDragging.value).toBe(true);
    wizard.handleDragLeave();
    expect(wizard.isDragging.value).toBe(false);

    wizard.handleDragOver({ preventDefault: prevent } as unknown as DragEvent);
    wizard.handleDrop({ preventDefault: prevent, dataTransfer: { files: [fileOf('a.csv', 'Title\nOne\n')] } } as unknown as DragEvent);
    expect(wizard.isDragging.value).toBe(false);
    await vi.waitFor(() => expect(wizard.excelRows.value).toHaveLength(1));

    wizard.resetState();
    wizard.handleFileSelect({ target: { files: [fileOf('b.csv', 'Title\nTwo\nThree\n')] } } as unknown as Event);
    await vi.waitFor(() => expect(wizard.excelRows.value).toHaveLength(2));

    wizard.handleDrop({ preventDefault: prevent, dataTransfer: { files: [] } } as unknown as DragEvent);
    wizard.handleFileSelect({ target: { files: [] } } as unknown as Event);
    expect(wizard.excelRows.value).toHaveLength(2);
  });

  it('goes back a step, but not before the first', () => {
    const wizard = useImportWizard('p');
    wizard.prevStep();
    expect(wizard.currentStep.value).toBe(1);
    wizard.currentStep.value = 3;
    wizard.prevStep();
    expect(wizard.currentStep.value).toBe(2);
  });

  it('selects all rows, or none when all are selected', () => {
    const wizard = useImportWizard('p');
    wizard.excelRows.value = [{ a: 1 }, { a: 2 }];
    wizard.toggleSelectAll();
    expect([...wizard.selectedRows.value]).toEqual([0, 1]);
    wizard.toggleSelectAll();
    expect(wizard.selectedRows.value.size).toBe(0);
  });
});

describe('useImportWizard: importing the rows', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(createTask).mockResolvedValue({} as never);
    vi.mocked(createBucket).mockResolvedValue({ name: 'trip' } as never);
  });

  const setup = (rows: Record<string, unknown>[], mappings: Partial<ReturnType<typeof useImportWizard>['mappings']['value']>) => {
    const wizard = useImportWizard('p');
    const store = useProjectStore();
    store.buckets = [
      { name: 'todo', title: 'To Do' },
      { name: 'done', title: 'Done' },
    ] as never;
    store.tasks = [{ title: 'Existing task' }] as never;
    store.invalidate = vi.fn().mockResolvedValue(undefined);
    store.fetchBuckets = vi.fn().mockResolvedValue(undefined);
    wizard.excelRows.value = rows;
    wizard.mappings.value = { ...wizard.mappings.value, ...mappings };
    wizard.selectedRows.value = new Set(rows.keys());
    return wizard;
  };

  it('sends what each row says: bucket, priority, dates, tags and the checklist', async () => {
    const wizard = setup(
      [
        {
          Title: 'Pack bags',
          Notes: 'Do it early',
          Bucket: 'to do',
          Prio: 'Wichtig',
          Start: 46315,
          Due: '2026-10-25T10:00:00Z',
          Tags: '#Trip, Family Home',
          Check: 'passport; tickets\n\nsunscreen',
        },
      ],
      {
        title: 'Title',
        description: 'Notes',
        bucket: 'Bucket',
        priority: 'Prio',
        startDate: 'Start',
        dueDate: 'Due',
        labels: 'Tags',
        checklist: 'Check',
      }
    );
    wizard.appendTags.value = 'Imported';

    await wizard.runImport();

    expect(createTask).toHaveBeenCalledWith('p', {
      title: 'Pack bags',
      bucket: 'todo',
      tags: ['trip', 'family', 'home', 'imported'],
      body: 'Do it early\n\n### Checklist\n- [ ] passport\n- [ ] tickets\n- [ ] sunscreen\n',
      due_date: '2026-10-25',
      planned_date: '2026-10-20',
      priority: 'high',
    });
    expect(wizard.importSummary.value).toEqual({ success: 1, skipped: 0, failed: 0 });
    expect(wizard.logs.value.at(-1)).toMatchObject({ type: 'success' });
  });

  it('skips duplicates of existing tasks and of earlier rows, and rows without a title', async () => {
    const wizard = setup([{ Title: 'existing TASK' }, { Title: 'New one' }, { Title: ' new one ' }, { Title: '' }], { title: 'Title' });
    wizard.bucketStrategy.value = 'single-column';

    await wizard.runImport();

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(wizard.importSummary.value).toEqual({ success: 1, skipped: 2, failed: 1 });
    expect(wizard.importProgressCurrent.value).toBe(4);
  });

  it('imports duplicates when asked to', async () => {
    const wizard = setup([{ Title: 'Existing task' }], { title: 'Title' });
    wizard.bucketStrategy.value = 'single-column';
    wizard.skipDuplicates.value = false;
    await wizard.runImport();
    expect(wizard.importSummary.value.success).toBe(1);
  });

  it('creates a column for a bucket it does not know, once, and falls back when that fails', async () => {
    const wizard = setup(
      [
        { Title: 'a', Bucket: 'Trip' },
        { Title: 'b', Bucket: 'trip' },
        { Title: 'c', Bucket: 'Other' },
      ],
      { title: 'Title', bucket: 'Bucket' }
    );
    vi.mocked(createBucket)
      .mockResolvedValueOnce({ name: 'trip' } as never)
      .mockRejectedValueOnce(new Error('no'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await wizard.runImport();

    expect(createBucket).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createTask).mock.calls.map((c) => c[1].bucket)).toEqual(['trip', 'trip', 'todo']);
    expect(wizard.logs.value.map((l) => l.text)).toEqual(
      expect.arrayContaining(['Creating custom column: "Trip"', 'Failed to create column "Other", using default instead.'])
    );
  });

  it('puts finished rows into done, whatever the strategy, and says so', async () => {
    const rows = [
      { Title: 'a', Bucket: 'To Do', Status: 'Completed' },
      { Title: 'b', Bucket: 'To Do', Status: 'In progress' },
    ];
    const wizard = setup(rows, { title: 'Title', bucket: 'Bucket', status: 'Status' });
    await wizard.runImport();
    expect(vi.mocked(createTask).mock.calls.map((c) => c[1].bucket)).toEqual(['done', 'todo']);
    expect(wizard.logs.value.some((l) => l.text.includes('Status override for "a"'))).toBe(true);

    vi.mocked(createTask).mockClear();
    const single = setup(rows, { title: 'Title', status: 'Status' });
    single.bucketStrategy.value = 'single-column';
    single.fallbackBucket.value = 'todo';
    await single.runImport();
    expect(vi.mocked(createTask).mock.calls.map((c) => c[1].bucket)).toEqual(['done', 'todo']);
    expect(single.logs.value.some((l) => l.text.includes('instead of single column'))).toBe(true);
  });

  it('maps the status to a column with the status strategy', async () => {
    const wizard = setup(
      [
        { Title: 'a', Status: 'Erledigt' },
        { Title: 'b', Status: 'In Bearbeitung' },
        { Title: 'c', Status: 'Not started' },
        { Title: 'd', Status: '' },
      ],
      { title: 'Title', status: 'Status' }
    );
    wizard.bucketStrategy.value = 'excel-status';
    await wizard.runImport();
    expect(vi.mocked(createTask).mock.calls.map((c) => c[1].bucket)).toEqual(['done', 'in-progress', 'in-progress', 'todo']);
  });

  it('counts a task the backend refuses as failed and goes on', async () => {
    const wizard = setup([{ Title: 'a' }, { Title: 'b' }], { title: 'Title' });
    wizard.bucketStrategy.value = 'single-column';
    vi.mocked(createTask).mockRejectedValueOnce(new Error('disk full'));
    const done = vi.fn();

    await wizard.runImport(done);

    expect(wizard.importSummary.value).toEqual({ success: 1, skipped: 0, failed: 1 });
    expect(wizard.logs.value.some((l) => l.type === 'error' && l.text.includes('disk full'))).toBe(true);
    expect(done).toHaveBeenCalled();
    expect(wizard.currentStep.value).toBe(5);
  });

  it('names the columns of the project, or the name when it has no title', () => {
    const wizard = setup([], {});
    expect(wizard.getBucketTitle('todo')).toBe('To Do');
    expect(wizard.getBucketTitle('review')).toBe('review');
  });

  it('reads dates as Excel stores them, and leaves out what is no date', () => {
    const wizard = useImportWizard('p');
    expect(wizard.parseExcelDate(46315)).toBe('2026-10-20');
    expect(wizard.parseExcelDate('2026-03-04')).toBe('2026-03-04');
    expect(wizard.parseExcelDate('not a date')).toBeUndefined();
    expect(wizard.parseExcelDate('')).toBeUndefined();
  });
});
