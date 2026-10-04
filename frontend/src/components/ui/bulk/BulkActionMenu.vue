<script setup lang="ts">
import { computed, ref } from 'vue';
import { Flag, Clock, FolderOpen, Slash } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket, Project } from '@/types';
import BulkDatePicker from './BulkDatePicker.vue';
import BulkTagMenu from './BulkTagMenu.vue';
import type { BulkMenu, DatePreset } from './types';

defineProps<{
  menu: Exclude<BulkMenu, 'none'>;
  buckets: Bucket[];
  projects: Project[];
  commonTags: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'move-bucket', bucket: string): void;
  (e: 'edit-tag', tag: string, forceRemove: boolean): void;
  (e: 'set-priority', priority: string): void;
  (e: 'set-planned', planned: string): void;
  (e: 'set-due-date', date: string): void;
  (e: 'move-project', projectId: string): void;
  (e: 'set-color', color: string | null): void;
  (e: 'set-postponed-date', date: string): void;
}>();

const { t, tBucket } = useI18n();
const tagMenuRef = ref<InstanceType<typeof BulkTagMenu> | null>(null);

const colors = [
  { id: 'red', name: 'Red', bg: 'bg-rose-500' },
  { id: 'orange', name: 'Orange', bg: 'bg-amber-600' },
  { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500' },
  { id: 'green', name: 'Green', bg: 'bg-emerald-500' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500' },
  { id: 'pink', name: 'Pink', bg: 'bg-pink-500' },
];

const dueDatePresets = computed<DatePreset[]>(() => [
  { id: 'today', label: t('bulkActions.dueDateToday'), offsetDays: 0 },
  { id: 'tomorrow', label: t('bulkActions.dueDateTomorrow'), offsetDays: 1 },
  { id: 'nextWeek', label: t('bulkActions.dueDateNextWeek'), offsetDays: 7 },
  { id: 'clear', label: t('bulkActions.dueDateClear') || 'Clear Due Date', offsetDays: null },
]);

const postponedPresets = computed<DatePreset[]>(() => [
  { id: 'tomorrow', label: t('dueDateOptions.postponedTomorrow') || 'Tomorrow', offsetDays: 1 },
  { id: 'nextWeek', label: t('dueDateOptions.postponedNextWeek') || 'Next Week', offsetDays: 7 },
  { id: 'clear', label: t('dueDateOptions.postponedClear') || 'Clear Postponement', offsetDays: null, wide: true },
]);

defineExpose({
  focusTagInput: () => tagMenuRef.value?.focus(),
});
</script>

<template>
  <div
    class="bg-theme-card border border-theme-border rounded-lg shadow-2xl p-1.5 min-w-[200px] mb-1 animate-in fade-in zoom-in duration-150 max-h-[60vh] overflow-y-auto"
  >
    <!-- Bucket Menu -->
    <div v-if="menu === 'bucket'" class="flex flex-col">
      <button
        v-for="b in buckets"
        :key="b.name"
        @click="
          emit('move-bucket', b.name);
          emit('close');
        "
        class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left cursor-pointer"
      >
        <div v-if="b.color" class="w-2 h-2 rounded-full" :style="{ backgroundColor: b.color }"></div>
        {{ tBucket(b.name, b.title) }}
      </button>
    </div>

    <!-- Tag Menu -->
    <BulkTagMenu
      v-if="menu === 'tag'"
      ref="tagMenuRef"
      :common-tags="commonTags"
      @edit-tag="(tag, remove) => emit('edit-tag', tag, remove)"
    />

    <!-- Priority Menu -->
    <div v-if="menu === 'priority'" class="flex flex-col">
      <button
        v-for="p in ['none', 'low', 'medium', 'high', 'urgent']"
        :key="p"
        @click="
          emit('set-priority', p === 'none' ? '' : p);
          emit('close');
        "
        class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left capitalize cursor-pointer"
      >
        <Flag
          class="w-3.5 h-3.5"
          :class="{
            'text-blue-400': p === 'low',
            'text-yellow-400': p === 'medium',
            'text-orange-400': p === 'high',
            'text-red-400': p === 'urgent',
            'text-theme-text-muted': p === 'none',
          }"
        />
        {{ p === 'none' ? t('priorityOptions.none') : t('priorityOptions.' + p) }}
      </button>
    </div>

    <!-- Planned Menu -->
    <div v-if="menu === 'planned'" class="flex flex-col">
      <button
        v-for="p in ['', 'today', 'tomorrow', 'thisWeek', 'thisMonth', 'sometime']"
        :key="p"
        @click="
          emit('set-planned', p);
          emit('close');
        "
        class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left cursor-pointer"
      >
        <Clock class="w-3.5 h-3.5 text-theme-text-muted" />
        {{ p === '' ? t('plannedDateOptions.none') : t('plannedDateOptions.' + p) }}
      </button>
    </div>

    <!-- Due Date Menu -->
    <BulkDatePicker
      v-if="menu === 'dueDate'"
      :title="t('bulkActions.setDueDate')"
      :presets="dueDatePresets"
      @select="
        (date) => {
          emit('set-due-date', date);
          emit('close');
        }
      "
    />

    <!-- Project Menu -->
    <div v-if="menu === 'project'" class="flex flex-col">
      <button
        v-for="p in projects"
        :key="p.id"
        @click="
          emit('move-project', p.id);
          emit('close');
        "
        class="flex items-center gap-2 px-3 py-2 hover:bg-theme-column rounded text-sm text-theme-text-main transition-colors text-left cursor-pointer"
      >
        <FolderOpen class="w-3.5 h-3.5 text-theme-text-muted" />
        {{ p.title }}
      </button>
    </div>

    <!-- Color Menu -->
    <div v-if="menu === 'color'" class="p-2">
      <div class="flex items-center gap-1.5">
        <button
          @click="
            emit('set-color', null);
            emit('close');
          "
          class="w-6 h-6 rounded-full border border-theme-border bg-theme-card flex items-center justify-center text-theme-text-muted hover:text-theme-text-main cursor-pointer"
          :title="t('colors.default') || 'Default'"
        >
          <Slash class="w-3 h-3" />
        </button>
        <button
          v-for="c in colors"
          :key="c.id"
          @click="
            emit('set-color', c.id);
            emit('close');
          "
          :class="[c.bg, 'w-6 h-6 rounded-full hover:scale-110 transition-transform cursor-pointer shadow-xs']"
          :title="c.name"
        ></button>
      </div>
    </div>

    <!-- Postponed Date Menu -->
    <BulkDatePicker
      v-if="menu === 'postponedDate'"
      :title="t('bulkActions.postpone') || 'Postpone'"
      :presets="postponedPresets"
      @select="
        (date) => {
          emit('set-postponed-date', date);
          emit('close');
        }
      "
    />
  </div>
</template>
