<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CheckCircle2, Calendar, Clock, Inbox } from '@lucide/vue';
import type { Task, Bucket } from '@/types';
import { useI18n } from '@/composables/useI18n';
import { useProjectStore } from '@/stores/project';
import TaskCard from '@/components/ui/TaskCard.vue';

const { t, locale } = useI18n();
const route = useRoute();
const projectStore = useProjectStore();

const activeProjectId = computed(() => (route.params.projectId as string) || '');

const props = defineProps<{
  buckets?: Bucket[];
  tasks?: Task[];
  isSelected?: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();

type Timeframe = 'today' | 'week' | 'last7days';
const selectedTimeframe = ref<Timeframe>('today');

// Fetch tasks including completed ones
const fetchReviewTasks = async () => {
  if (!activeProjectId.value) return;
  await projectStore.fetchTasks({
    projectId: activeProjectId.value,
    excludeBuckets: '',
  });
};

onMounted(async () => {
  await fetchReviewTasks();
});

watch(activeProjectId, async () => {
  await fetchReviewTasks();
});

// Helper to parse completion date from updated_at or created_at
const getTaskDate = (task: Task): Date => {
  const dateStr = task.updated_at || task.created_at;
  if (!dateStr) return new Date(0);
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

// Filter tasks to only completed ones within selected timeframe
const completedTasks = computed(() => {
  const sourceTasks = props.tasks ?? projectStore.tasks;
  const doneBuckets = new Set(['done', 'archive', 'archived', 'completed']);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Start of current week (Monday)
  const currentDay = now.getDay(); // 0 is Sun, 1 is Mon...
  const distanceToMonday = (currentDay + 6) % 7;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - distanceToMonday);

  // 7 days ago
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return sourceTasks
    .filter((task) => {
      const isDoneBucket = doneBuckets.has((task.bucket || '').toLowerCase());
      if (!isDoneBucket) return false;

      const taskDate = getTaskDate(task);
      if (taskDate.getTime() === 0) return false;

      if (selectedTimeframe.value === 'today') {
        return taskDate >= startOfToday;
      } else if (selectedTimeframe.value === 'week') {
        return taskDate >= startOfWeek;
      } else if (selectedTimeframe.value === 'last7days') {
        return taskDate >= sevenDaysAgo;
      }
      return false;
    })
    .sort((a, b) => getTaskDate(b).getTime() - getTaskDate(a).getTime());
});

// Group completed tasks by date string (YYYY-MM-DD)
interface DateGroup {
  dateKey: string;
  formattedDate: string;
  tasks: Task[];
}

const formatGroupHeader = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateKey === todayKey) {
    return t('review.today') || 'Today';
  }
  if (dateKey === yesterdayKey) {
    return t('review.yesterday') || 'Yesterday';
  }

  return targetDate.toLocaleDateString(locale.value === 'de' ? 'de-DE' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

const groupedTasks = computed<DateGroup[]>(() => {
  const groupsMap = new Map<string, Task[]>();

  for (const task of completedTasks.value) {
    const d = getTaskDate(task);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, []);
    }
    groupsMap.get(dateKey)!.push(task);
  }

  const result: DateGroup[] = [];
  groupsMap.forEach((tasks, dateKey) => {
    result.push({
      dateKey,
      formattedDate: formatGroupHeader(dateKey),
      tasks,
    });
  });

  return result;
});
</script>

<template>
  <div class="h-full flex flex-col bg-theme-base overflow-hidden">
    <!-- Header / Timeframe Filter Bar -->
    <div class="px-6 py-4 border-b border-theme-border flex flex-wrap items-center justify-between gap-4 shrink-0 bg-theme-card/50">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 class="w-5 h-5" />
        </div>
        <div>
          <h2 class="text-base font-bold text-theme-text-main flex items-center gap-2">
            {{ t('review.title') || 'Standup & Review' }}
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-theme-column border border-theme-border text-theme-text-muted">
              {{ completedTasks.length }}
            </span>
          </h2>
          <p class="text-xs text-theme-text-muted">
            {{ t('review.subtitle') || 'Overview of completed tasks for reviews and standups' }}
          </p>
        </div>
      </div>

      <!-- Timeframe Toggle Buttons -->
      <div class="flex items-center bg-theme-column/30 border border-theme-border rounded-lg p-0.5 text-xs font-medium">
        <button
          @click="selectedTimeframe = 'today'"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer"
          :class="
            selectedTimeframe === 'today'
              ? 'bg-theme-card text-theme-text-main shadow-xs font-semibold'
              : 'text-theme-text-muted hover:text-theme-text-main'
          "
        >
          <Clock class="w-3.5 h-3.5" />
          <span>{{ t('review.timeframeToday') || 'Today' }}</span>
        </button>

        <button
          @click="selectedTimeframe = 'week'"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer"
          :class="
            selectedTimeframe === 'week'
              ? 'bg-theme-card text-theme-text-main shadow-xs font-semibold'
              : 'text-theme-text-muted hover:text-theme-text-main'
          "
        >
          <Calendar class="w-3.5 h-3.5" />
          <span>{{ t('review.timeframeWeek') || 'This Week' }}</span>
        </button>

        <button
          @click="selectedTimeframe = 'last7days'"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer"
          :class="
            selectedTimeframe === 'last7days'
              ? 'bg-theme-card text-theme-text-main shadow-xs font-semibold'
              : 'text-theme-text-muted hover:text-theme-text-main'
          "
        >
          <Calendar class="w-3.5 h-3.5" />
          <span>{{ t('review.timeframeLast7Days') || 'Last 7 Days' }}</span>
        </button>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-grow overflow-y-auto p-6 space-y-6">
      <!-- Empty State -->
      <div
        v-if="completedTasks.length === 0"
        class="h-64 flex flex-col items-center justify-center text-center p-8 border border-dashed border-theme-border rounded-xl bg-theme-card/30"
      >
        <div class="p-3 bg-theme-column/50 rounded-full text-theme-text-muted mb-3">
          <Inbox class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-bold text-theme-text-main">
          {{ t('review.noCompletedTasksTitle') || 'No completed tasks in this period' }}
        </h3>
        <p class="text-xs text-theme-text-muted max-w-sm mt-1">
          {{ t('review.noCompletedTasksDesc') || 'Tasks completed during the selected timeframe will appear here automatically.' }}
        </p>
      </div>

      <!-- Grouped TaskCards by Date -->
      <div v-else class="space-y-6 max-w-4xl mx-auto">
        <div v-for="group in groupedTasks" :key="group.dateKey" class="space-y-3">
          <!-- Date Header -->
          <div class="flex items-center justify-between border-b border-theme-border/60 pb-2">
            <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-2">
              <Calendar class="w-3.5 h-3.5 text-theme-primary" />
              {{ group.formattedDate }}
            </h3>
            <span class="text-[11px] font-semibold text-theme-text-muted px-2 py-0.5 rounded-md bg-theme-column/40">
              {{ group.tasks.length }} {{ group.tasks.length === 1 ? t('review.task') || 'task' : t('review.tasks') || 'tasks' }}
            </span>
          </div>

          <!-- Tasks Grid / List -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TaskCard
              v-for="task in group.tasks"
              :key="task.id"
              :task="task"
              :show-tags="true"
              :show-done-button="false"
              :show-project="activeProjectId === 'all'"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
