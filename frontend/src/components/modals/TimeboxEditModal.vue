<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { X, Trash2, Calendar, Clock, Palette } from '@lucide/vue';
import type { Timebox } from '@/types';
import { useTimeboxStore } from '@/stores/timebox';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';

const props = defineProps<{
  isOpen: boolean;
  timebox?: Timebox | null;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
}>();

const { t } = useI18n();
const timeboxStore = useTimeboxStore();
const { showDialog } = useDialog();

const title = ref('');
const date = ref('');
const startTime = ref('09:00');
const endTime = ref('10:00');
const color = ref<string | null>('indigo');
const loading = ref(false);
const titleInput = ref<HTMLInputElement | null>(null);

const COLOR_PRESETS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500', border: 'border-indigo-400' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-500', border: 'border-blue-400' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500', border: 'border-emerald-400' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', border: 'border-amber-400' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', border: 'border-rose-400' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-500', border: 'border-purple-400' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-500', border: 'border-teal-400' },
  { id: 'slate', label: 'Slate', bg: 'bg-slate-500', border: 'border-slate-400' },
];

const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRandomColor = () => {
  const options = ['blue', 'emerald', 'amber', 'rose', 'teal', 'indigo', 'purple', 'slate'];
  return options[Math.floor(Math.random() * options.length)];
};

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (props.timebox) {
        title.value = props.timebox.title;
        date.value = props.timebox.date;
        startTime.value = props.timebox.startTime;
        endTime.value = props.timebox.endTime;
        color.value = props.timebox.color || 'indigo';
      } else {
        title.value = '';
        date.value = props.initialDate || getTodayStr();
        startTime.value = props.initialStartTime || '09:00';
        endTime.value = props.initialEndTime || '10:00';
        color.value = getRandomColor();
      }
      nextTick(() => {
        titleInput.value?.focus();
      });
    }
  },
  { immediate: true }
);

const handleSave = async () => {
  if (!title.value.trim()) return;
  if (startTime.value >= endTime.value) return;

  loading.value = true;
  try {
    if (props.timebox) {
      await timeboxStore.updateTimebox(props.timebox.id, {
        title: title.value.trim(),
        date: date.value,
        startTime: startTime.value,
        endTime: endTime.value,
        color: color.value,
      });
    } else {
      await timeboxStore.createTimebox({
        title: title.value.trim(),
        date: date.value,
        startTime: startTime.value,
        endTime: endTime.value,
        color: color.value,
        taskIds: [],
      });
    }
    emit('save');
    emit('close');
  } finally {
    loading.value = false;
  }
};

const handleDelete = async () => {
  if (!props.timebox) return;
  const confirmed = await showDialog({
    title: t('timebox.deleteTitle'),
    message: t('timebox.deleteConfirm'),
    type: 'error',
    showCancel: true,
    confirmText: t('buttons.delete'),
    cancelText: t('buttons.cancel'),
  });
  if (!confirmed) return;

  loading.value = true;
  try {
    await timeboxStore.deleteTimebox(props.timebox.id);
    emit('save');
    emit('close');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <div
      class="bg-theme-card border border-theme-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-all"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-theme-border/60 bg-theme-column/30">
        <h2 class="text-base font-bold text-theme-text-main flex items-center gap-2">
          <Calendar class="w-4 h-4 text-theme-primary" />
          {{ timebox ? t('timebox.editTitle') : t('timebox.newTitle') }}
        </h2>
        <button
          type="button"
          @click="emit('close')"
          class="p-1 rounded-lg text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSave" class="p-5 space-y-4">
        <!-- Title Input -->
        <div>
          <label class="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5">
            {{ t('timebox.titleLabel') }}
          </label>
          <input
            ref="titleInput"
            v-model="title"
            type="text"
            required
            :placeholder="t('timebox.titlePlaceholder')"
            class="w-full px-3.5 py-2 rounded-lg bg-theme-base/80 border border-theme-border text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring transition-all"
          />
        </div>

        <!-- Date Input -->
        <div>
          <label class="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5">
            {{ t('timebox.dateLabel') }}
          </label>
          <input
            v-model="date"
            type="date"
            required
            class="w-full px-3.5 py-2 rounded-lg bg-theme-base/80 border border-theme-border text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring transition-all"
          />
        </div>

        <!-- Time Range Grid -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock class="w-3.5 h-3.5" />
              {{ t('timebox.startLabel') }}
            </label>
            <input
              v-model="startTime"
              type="time"
              required
              class="w-full px-3.5 py-2 rounded-lg bg-theme-base/80 border border-theme-border text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring transition-all"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock class="w-3.5 h-3.5" />
              {{ t('timebox.endLabel') }}
            </label>
            <input
              v-model="endTime"
              type="time"
              required
              class="w-full px-3.5 py-2 rounded-lg bg-theme-base/80 border border-theme-border text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring transition-all"
            />
          </div>
        </div>

        <!-- Color Palette Picker -->
        <div>
          <label class="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Palette class="w-3.5 h-3.5" />
            {{ t('timebox.colorLabel') }}
          </label>
          <div class="flex items-center gap-2 flex-wrap pt-1">
            <button
              v-for="preset in COLOR_PRESETS"
              :key="preset.id"
              type="button"
              @click="color = preset.id"
              class="w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center"
              :class="[
                preset.bg,
                color === preset.id
                  ? 'ring-2 ring-offset-2 ring-offset-theme-card ring-white scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-105',
              ]"
              :title="preset.label"
            ></button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between pt-3 border-t border-theme-border/60">
          <div>
            <button
              v-if="timebox"
              type="button"
              @click="handleDelete"
              :disabled="loading"
              class="px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
              {{ t('buttons.delete') }}
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column rounded-lg transition-colors cursor-pointer"
            >
              {{ t('buttons.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="loading || !title.trim() || startTime >= endTime"
              class="px-4 py-2 text-xs font-semibold bg-theme-primary text-white hover:bg-theme-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer"
            >
              {{ timebox ? t('buttons.save') : t('buttons.create') }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
