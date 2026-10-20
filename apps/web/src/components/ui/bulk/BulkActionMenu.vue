<script setup lang="ts">
import { computed, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { Flag, FolderOpen, Slash } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket, Project } from '@/types';
import BulkDatePicker from './BulkDatePicker.vue';
import { plannedChoices } from '@/utils/planned';
import BulkTagMenu from './BulkTagMenu.vue';
import type { BulkMenu, DatePreset } from './types';

const props = defineProps<{
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

const plannedPresets = computed<DatePreset[]>(() => [
  ...plannedChoices().map(({ preset, value }) => ({ id: preset, label: t('plannedDateOptions.' + preset), offsetDays: null, value })),
  { id: 'none', label: t('plannedDateOptions.none'), offsetDays: null, value: '', wide: true },
]);

// The number keys 1-9 pick the entry in that position, so a menu opened by its hotkey works without the mouse.
const rootRef = ref<HTMLElement | null>(null);
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (props.menu === 'tag' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  if (!/^[1-9]$/.test(event.key)) return;
  const tag = (document.activeElement as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const entry = rootRef.value?.querySelectorAll('button')[Number(event.key) - 1];
  if (entry) {
    event.preventDefault();
    entry.click();
  }
});

defineExpose({
  focusTagInput: () => tagMenuRef.value?.focus(),
});
</script>

<template>
  <div
    ref="rootRef"
    class="bg-theme-card border border-theme-border rounded-lg shadow-2xl p-1.5 min-w-[200px] mb-1 animate-in fade-in zoom-in duration-150"
    :class="{ 'max-h-[60vh] overflow-y-auto': menu !== 'tag' }"
  >
    <!-- The tag menu does not scroll (see the class above): it would clip the suggestions that drop out of its input -->
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
    <BulkDatePicker
      v-if="menu === 'planned'"
      :title="t('bulkActions.planFor')"
      :presets="plannedPresets"
      @select="
        (value) => {
          emit('set-planned', value);
          emit('close');
        }
      "
    />

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
  </div>
</template>
