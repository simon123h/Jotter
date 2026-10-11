<script setup lang="ts">
import type { Mappings } from '../composables/useImportWizard';
import { useI18n } from '@/composables/useI18n';

defineProps<{
  excelRows: Record<string, any>[];
  selectedRows: Set<number>;
  mappings: Mappings;
  bucketStrategy: 'excel-bucket' | 'excel-status' | 'single-column';
  fallbackBucket: string;
  getDestinationBucketInfo: (row: Record<string, any>) => { bucketName: string; isOverride: boolean; originalBucket: string };
  getBucketTitle: (name: string) => string;
  parseExcelPriority: (val: any) => string;
  parseExcelDate: (val: any) => string | undefined;
}>();

const emit = defineEmits<{
  (e: 'toggle-row', idx: number): void;
  (e: 'toggle-select-all'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center bg-theme-card/30 border border-theme-border/60 rounded px-4 py-2 text-xs">
      <span class="text-theme-text-muted">
        {{ t('importWizard.selectedTasksCount', { count: selectedRows.size, total: excelRows.length }) }}
      </span>
      <button
        @click="emit('toggle-select-all')"
        class="text-theme-primary hover:text-theme-primary-hover font-semibold transition-colors cursor-pointer animate-none"
      >
        {{ selectedRows.size === excelRows.length ? t('importWizard.deselectAll') : t('importWizard.selectAll') }}
      </button>
    </div>

    <div class="border border-theme-border rounded-lg overflow-hidden max-h-[350px] overflow-y-auto scroller-thin">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-theme-card/50 border-b border-theme-border sticky top-0 z-10">
          <tr>
            <th class="p-3 w-10 text-center">
              <input
                type="checkbox"
                :checked="selectedRows.size === excelRows.length"
                @change="emit('toggle-select-all')"
                class="rounded"
              />
            </th>
            <th class="p-3 font-semibold text-theme-text-muted">{{ t('importWizard.tableHeaderTitle') }}</th>
            <th class="p-3 font-semibold text-theme-text-muted">{{ t('importWizard.tableHeaderColumn') }}</th>
            <th class="p-3 font-semibold text-theme-text-muted">{{ t('importWizard.tableHeaderPriority') }}</th>
            <th class="p-3 font-semibold text-theme-text-muted">{{ t('importWizard.tableHeaderDueDate') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-theme-border/40">
          <tr
            v-for="(row, idx) in excelRows"
            :key="idx"
            class="hover:bg-theme-column/10 cursor-pointer transition-colors"
            @click="emit('toggle-row', idx)"
          >
            <td class="p-3 text-center" @click.stop>
              <input type="checkbox" :checked="selectedRows.has(idx)" @change="emit('toggle-row', idx)" class="rounded" />
            </td>
            <td class="p-3 font-semibold text-theme-text-main max-w-xs truncate" :title="row[mappings.title]">
              {{ row[mappings.title] || t('importWizard.emptyTitlePlaceholder') }}
            </td>
            <td class="p-3 text-theme-text-muted font-mono text-[11px]">
              <span v-if="getDestinationBucketInfo(row).isOverride" class="block">
                <span class="text-theme-text-muted line-through mr-1 text-[10px]">
                  {{ getBucketTitle(getDestinationBucketInfo(row).originalBucket) }}
                </span>
                <span class="text-emerald-500 font-semibold">{{ t('importWizard.doneOverride') }}</span>
              </span>
              <span
                v-else-if="bucketStrategy === 'excel-bucket' && mappings.bucket"
                class="truncate block font-semibold text-theme-text-main"
              >
                {{ getBucketTitle(row[mappings.bucket] || 'To Do') }}
              </span>
              <span
                v-else-if="bucketStrategy === 'excel-status' && mappings.status"
                class="capitalize block font-semibold text-theme-text-main"
              >
                {{ getBucketTitle(getDestinationBucketInfo(row).bucketName) }}
              </span>
              <span v-else class="text-theme-text-main font-semibold">
                {{ getBucketTitle(fallbackBucket) }}
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
</template>
