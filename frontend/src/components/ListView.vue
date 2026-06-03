<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown, ClipboardList } from '@lucide/vue';
import type { Task, Bucket } from '../types';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

defineProps<{
  buckets: Bucket[];
  tasksByBucket: Record<string, Task[]>;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
}>();

// Collapsed state for columns in List view
const collapsedColumns = ref<Record<string, boolean>>({});
const toggleColumnCollapse = (bucketName: string) => {
  collapsedColumns.value[bucketName] = !collapsedColumns.value[bucketName];
};

// Checklist helper
const getChecklistStats = (body: string) => {
  if (!body) return null;
  const matches = body.match(/- \[[ xX]\]/g);
  if (!matches) return null;
  const total = matches.length;
  const checked = (body.match(/- \[[xX]\]/g) || []).length;
  return { checked, total };
};
</script>

<template>
  <div class="h-full overflow-y-auto scroller-thin border border-theme-border rounded bg-theme-card/10">
    <div class="min-w-[800px] w-full border-collapse text-left font-sans text-sm">
      <!-- Table Header -->
      <div
        class="flex items-center bg-theme-column/60 border-b border-theme-border text-xs font-bold uppercase tracking-wider text-theme-text-muted px-3 py-2 select-none sticky top-0 z-10 backdrop-blur-sm"
      >
        <span class="flex-grow min-w-0">{{ t('table.title') }}</span>
        <span class="w-20 shrink-0 text-center">{{ t('table.progress') }}</span>
        <span class="w-52 shrink-0">{{ t('table.tags') }}</span>
      </div>

      <!-- Grouped by bucket -->
      <div v-for="b in buckets" :key="b.name" class="border-b border-theme-border last:border-b-0">
        <!-- Group Header -->
        <div
          @click="toggleColumnCollapse(b.name)"
          class="bg-theme-column/25 px-3 py-1.5 flex items-center gap-2 cursor-pointer select-none hover:bg-theme-column/40 border-b border-theme-border/30 text-xs font-bold uppercase tracking-wider text-theme-text-muted"
        >
          <ChevronDown
            class="w-3.5 h-3.5 transform transition-transform text-theme-text-muted animate-duration-150"
            :class="{ '-rotate-90': collapsedColumns[b.name] }"
          />
          <span>{{ t('buckets.' + b.name) || b.title }}</span>
          <span
            v-if="b.subtitle"
            class="text-xs lowercase italic text-theme-text-muted/60 font-sans tracking-normal ml-1.5 normal-case font-medium"
          >
            &mdash; {{ b.subtitle }}
          </span>
          <span class="px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted rounded text-xs font-bold">
            {{ tasksByBucket[b.name]?.length || 0 }}
          </span>
        </div>

        <!-- Group Rows -->
        <div v-show="!collapsedColumns[b.name]" class="divide-y divide-theme-border/30 bg-theme-card/10">
          <div v-if="!tasksByBucket[b.name] || !tasksByBucket[b.name].length" class="px-8 py-2 text-theme-text-muted italic text-xs">
            No tasks in this column.
          </div>
          <div
            v-else
            v-for="task in tasksByBucket[b.name]"
            :key="task.id"
            @click="emit('task-click', task)"
            class="flex items-center hover:bg-theme-column/20 px-3 py-2 cursor-pointer transition-colors duration-100 gap-3 group"
          >
            <!-- Task Title + Note snippet -->
            <div class="flex-grow min-w-0 flex items-baseline gap-2 overflow-hidden">
              <span class="font-bold text-theme-text-card group-hover:text-theme-accent transition-colors truncate">
                {{ task.title }}
              </span>
              <!-- Sneak peak of markdown body if available -->
              <span v-if="task.body" class="text-theme-text-muted/60 text-xs truncate italic max-w-[28rem] font-sans">
                -
                {{
                  task.body
                    .replace(/#+\s+/g, '')
                    .replace(/[-*]\s+\[[ xX]\]/g, '')
                    .replace(/[-*]\s+/g, '')
                    .replace(/[`*_]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                }}
              </span>
            </div>

            <!-- Checklist Stats -->
            <div class="w-20 shrink-0 flex items-center justify-center">
              <span
                v-if="getChecklistStats(task.body)"
                class="flex items-center gap-1 text-xs font-bold"
                :class="
                  getChecklistStats(task.body)!.checked === getChecklistStats(task.body)!.total
                    ? 'text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20'
                    : 'text-theme-text-muted'
                "
              >
                <ClipboardList class="w-3 h-3 shrink-0" />
                <span>{{ getChecklistStats(task.body)!.checked }}/{{ getChecklistStats(task.body)!.total }}</span>
              </span>
            </div>

            <!-- Tags -->
            <div class="w-52 shrink-0 overflow-hidden flex flex-wrap gap-1">
              <span
                v-for="tag in task.tags"
                :key="tag"
                class="text-xs uppercase font-bold tracking-wider px-1 py-0.5 rounded border bg-theme-column/30 text-theme-text-muted border-theme-border/45"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
