<script setup lang="ts">
import { Settings, FileSpreadsheet, ListTodo } from '@lucide/vue';
import type { Mappings } from '../composables/useImportWizard';

defineProps<{
  fileName: string;
  excelRowsLength: number;
  sheetNames: string[];
  excelHeaders: string[];
  availableBuckets: { name: string; title: string }[];
}>();

const emit = defineEmits<{
  (e: 'load-sheet', sheetName: string): void;
}>();

const mappings = defineModel<Mappings>('mappings', { required: true });
const bucketStrategy = defineModel<'excel-bucket' | 'excel-status' | 'single-column'>('bucketStrategy', { required: true });
const fallbackBucket = defineModel<string>('fallbackBucket', { required: true });
const skipDuplicates = defineModel<boolean>('skipDuplicates', { required: true });
const appendTags = defineModel<string>('appendTags', { required: true });
const selectedSheetName = defineModel<string>('selectedSheetName', { required: true });
</script>

<template>
  <div class="space-y-5">
    <div class="p-4 bg-theme-card/50 border border-theme-border rounded-lg space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FileSpreadsheet class="w-4 h-4 text-emerald-500" />
          <span class="text-xs font-bold text-theme-text-main font-mono">{{ fileName }}</span>
        </div>
        <span
          class="text-[11px] px-2 py-0.5 bg-theme-primary/10 border border-theme-primary/15 text-theme-accent rounded font-semibold"
        >
          {{ excelRowsLength }} rows detected
        </span>
      </div>

      <!-- Sheet Selector if there are multiple sheets -->
      <div
        v-if="sheetNames.length > 1"
        class="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-theme-border/50"
      >
        <span class="text-xs text-theme-text-muted shrink-0 font-semibold">Select Sheet:</span>
        <select
          :value="selectedSheetName"
          @change="emit('load-sheet', ($event.target as HTMLSelectElement).value)"
          class="bg-theme-card border border-theme-border rounded px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary flex-grow font-mono"
        >
          <option v-for="name in sheetNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </div>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Notes & Description </label>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Bucket Name (Columns) </label>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Status (Progress) </label>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Priority </label>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Labels (Tags) </label>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Start Date </label>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Due Date </label>
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
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1"> Checklist Items </label>
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
            <input v-model="bucketStrategy" type="radio" value="excel-bucket" :disabled="!mappings.bucket" class="mt-1" />
            <div>
              <span class="text-xs font-bold text-theme-text-main block">Use Excel's Bucket Name column</span>
              <span class="text-[10.5px] text-theme-text-muted leading-tight block">
                Tasks are created inside columns named after their Excel bucket. Missing columns will be created automatically.
              </span>
            </div>
          </label>

          <label class="flex items-start gap-2.5 cursor-pointer">
            <input v-model="bucketStrategy" type="radio" value="excel-status" :disabled="!mappings.status" class="mt-1" />
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
            <span class="text-[10.5px] text-theme-text-muted block"
              >Prevents duplicate tasks if a task with the exact title already exists in this project.</span
            >
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
</template>
