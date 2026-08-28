<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronUp, ChevronDown, Calendar, Layers, Flag } from '@lucide/vue';
import type { Task, Bucket } from '@/types';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useSelectionStore } from '@/stores/selection';
import { storeToRefs } from 'pinia';

const { t, locale, tBucket } = useI18n();
const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const selectionStore = useSelectionStore();
const activeProjectId = computed(() => (route.params.projectId as string) || '');
const { hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

const onDragStart = (event: DragEvent, task: Task) => {
  document.body.classList.add('dragging-active');
  selectionStore.startDragging(task.id);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
  }
};

const onDragEnd = () => {
  document.body.classList.remove('dragging-active');
  selectionStore.stopDragging();
};

const props = defineProps<{
  buckets: Bucket[];
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
}>();

const fetchViewTasks = async () => {
  if (!activeProjectId.value) return;
  await projectStore.fetchTasks({
    projectId: activeProjectId.value,
  });
};

onMounted(async () => {
  await fetchViewTasks();
});

watch([activeProjectId, hideDoneColumn, hideArchiveColumn], async () => {
  await fetchViewTasks();
});

const getTaskRoute = (task: Task) => {
  const viewMode = String(route?.name || '').replace('-task', '') || 'list';
  return {
    name: `${viewMode}-task`,
    params: {
      projectId: route?.params?.projectId === 'all' ? 'all' : task.project_id,
      taskId: String(task.id),
    },
    query: route.query,
  };
};

const openTask = (task: Task) => {
  router.push(getTaskRoute(task));
};

const handleTagClick = (tag: string) => {
  const normalizedTag = tag.trim().toLowerCase();
  router.replace({
    query: {
      ...route.query,
      tags: normalizedTag,
    },
  });
};

type SortKey = 'title' | 'bucket' | 'priority' | 'due_date' | 'planned_date' | 'created_at';
const sortKey = ref<SortKey>('created_at');
const sortOrder = ref<'asc' | 'desc'>('desc');

const isAllSelected = computed(() => {
  return props.tasks.length > 0 && props.tasks.every((t) => props.isSelected(t.id));
});

const sortedTasks = computed(() => {
  return [...props.tasks].sort((a, b) => {
    let valA: any = a[sortKey.value] || '';
    let valB: any = b[sortKey.value] || '';

    if (sortKey.value === 'priority') {
      const prioMap: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, '': 0 };
      valA = prioMap[a.priority || ''] || 0;
      valB = prioMap[b.priority || ''] || 0;
    }

    if (valA < valB) return sortOrder.value === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder.value === 'asc' ? 1 : -1;
    return 0;
  });
});

const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getPriorityClasses = (prio?: string) => {
  switch (prio) {
    case 'low':
      return 'text-blue-400';
    case 'medium':
      return 'text-yellow-400';
    case 'high':
      return 'text-orange-400';
    case 'urgent':
      return 'text-red-400 font-bold';
    default:
      return 'text-theme-text-muted';
  }
};

const getBucketTitle = (name: string) => {
  const b = props.buckets.find((b) => b.name === name);
  return tBucket(name, b?.title);
};
</script>

<template>
  <div class="h-full flex flex-col border border-theme-border rounded bg-theme-card/10 overflow-hidden">
    <div class="flex-grow overflow-auto scroller-thin">
      <table class="w-full border-collapse text-left font-sans text-sm relative">
        <thead class="sticky top-0 z-20">
          <tr
            class="bg-theme-column/80 backdrop-blur-md border-b border-theme-border text-xs font-bold uppercase tracking-wider text-theme-text-muted select-none"
          >
            <th class="px-4 py-3 w-10">
              <input type="checkbox" :checked="isAllSelected" class="accent-theme-primary cursor-pointer" />
            </th>
            <th @click="toggleSort('title')" class="px-4 py-3 cursor-pointer hover:text-theme-accent transition-colors min-w-[300px]">
              <div class="flex items-center gap-1">
                {{ t('table.title') }}
                <component :is="sortKey === 'title' ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : null" class="w-3 h-3" />
              </div>
            </th>
            <th @click="toggleSort('bucket')" class="px-4 py-3 cursor-pointer hover:text-theme-accent transition-colors w-40">
              <div class="flex items-center gap-1">
                <Layers class="w-3 h-3" /> {{ t('table.status') }}
                <component :is="sortKey === 'bucket' ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : null" class="w-3 h-3" />
              </div>
            </th>
            <th @click="toggleSort('priority')" class="px-4 py-3 cursor-pointer hover:text-theme-accent transition-colors w-32 text-center">
              <div class="flex items-center justify-center gap-1">
                <Flag class="w-3 h-3" /> {{ t('form.priorityLabel') }}
                <component :is="sortKey === 'priority' ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : null" class="w-3 h-3" />
              </div>
            </th>
            <th @click="toggleSort('due_date')" class="px-4 py-3 cursor-pointer hover:text-theme-accent transition-colors w-32 text-center">
              <div class="flex items-center justify-center gap-1">
                <Calendar class="w-3 h-3" /> {{ t('form.dueDateLabel') }}
                <component :is="sortKey === 'due_date' ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : null" class="w-3 h-3" />
              </div>
            </th>
            <th
              @click="toggleSort('planned_date')"
              class="px-4 py-3 cursor-pointer hover:text-theme-accent transition-colors w-32 text-center"
            >
              <div class="flex items-center justify-center gap-1">
                P: {{ t('form.plannedDateLabel') }}
                <component :is="sortKey === 'planned_date' ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : null" class="w-3 h-3" />
              </div>
            </th>
            <th
              @click="toggleSort('created_at')"
              class="px-4 py-3 cursor-pointer hover:text-theme-accent transition-colors w-40 text-right"
            >
              <div class="flex items-center justify-end gap-1">
                {{ t('table.updated') }}
                <component :is="sortKey === 'created_at' ? (sortOrder === 'asc' ? ChevronUp : ChevronDown) : null" class="w-3 h-3" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-theme-border/20">
          <tr
            v-for="task in sortedTasks"
            :key="task.id"
            @click="openTask(task)"
            class="hover:bg-theme-column/15 transition-colors cursor-pointer group"
            :class="[isSelected(task.id) ? 'bg-theme-accent/5' : '', selectionStore.draggingTaskIds.includes(task.id) ? 'opacity-40' : '']"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @dragend="onDragEnd"
          >
            <td class="px-4 py-2.5" @click.stop>
              <input
                type="checkbox"
                :checked="isSelected(task.id)"
                @change="emit('toggle-select', task)"
                class="accent-theme-primary cursor-pointer"
              />
            </td>
            <td class="px-4 py-2.5">
              <div class="flex flex-col gap-0.5">
                <span
                  v-if="activeProjectId === 'all'"
                  class="text-[9px] font-bold uppercase tracking-widest text-theme-accent/70 block mb-0.5 select-none"
                >
                  {{ projectStore.projects.find((p) => p.id === task.project_id)?.title || task.project_id }}
                </span>
                <router-link
                  :to="getTaskRoute(task)"
                  class="text-theme-text-card font-medium hover:text-theme-accent transition-colors truncate max-w-lg block no-underline"
                  @click.stop
                >
                  {{ task.title }}
                </router-link>
                <div v-if="task.tags.length" class="flex flex-wrap gap-1 mt-0.5">
                  <span
                    v-for="tag in task.tags"
                    :key="tag"
                    class="text-[10px] px-1 py-0 bg-theme-column/40 text-theme-text-muted rounded border border-theme-border/30 uppercase font-bold tracking-tighter cursor-pointer transition-transform"
                    @click.stop.prevent="handleTagClick(tag)"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </td>
            <td class="px-4 py-2.5">
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-theme-card border border-theme-border text-theme-text-muted whitespace-nowrap"
              >
                {{ getBucketTitle(task.bucket) }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-center">
              <span v-if="task.priority" class="text-xs uppercase tracking-widest" :class="getPriorityClasses(task.priority)">
                {{ task.priority }}
              </span>
              <span v-else class="text-theme-text-muted opacity-30">-</span>
            </td>
            <td class="px-4 py-2.5 text-center text-xs text-theme-text-card">
              {{ formatDate(task.due_date) }}
            </td>
            <td class="px-4 py-2.5 text-center text-xs font-semibold">
              <span v-if="task.planned_date" class="text-theme-accent/80">
                {{ t('plannedDateOptions.' + task.planned_date) }}
              </span>
              <span v-else class="text-theme-text-muted opacity-30">-</span>
            </td>
            <td class="px-4 py-2.5 text-right text-xs text-theme-text-muted font-mono whitespace-nowrap">
              {{
                new Date(task.updated_at).toLocaleDateString(locale, {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="sortedTasks.length === 0" class="p-12 text-center text-theme-text-muted italic">
        {{ t('emptyStateTitle') }}
      </div>
    </div>
  </div>
</template>
