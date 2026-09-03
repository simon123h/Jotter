<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Slash, Trash2 } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import BaseModal from '@/components/ui/BaseModal.vue';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  bucketName: string;
  initialTitle: string;
  initialSubtitle?: string | null;
  initialColor?: string | null;
  initialLayout?: 'list' | 'grid-2' | 'grid-3';
  initialMaxTasks?: number | null;
  tasksCount?: number;
  initialIsDefault?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'delete-column'): void;
  (
    e: 'save',
    payload: {
      bucketName: string;
      title: string;
      subtitle: string;
      color: string | null;
      layout: 'list' | 'grid-2' | 'grid-3';
      max_tasks: number | null;
      is_default: boolean;
    }
  ): void;
}>();

const title = ref(props.initialTitle);
const subtitle = ref(props.initialSubtitle || '');
const color = ref<string | null>(props.initialColor || null);
const layout = ref<'list' | 'grid-2' | 'grid-3'>(props.initialLayout || 'list');
const maxTasks = ref<string>(props.initialMaxTasks ? String(props.initialMaxTasks) : '');
const isDefault = ref<boolean>(props.initialIsDefault || false);
const titleInput = ref<HTMLInputElement | null>(null);

const colors = [
  { id: 'rose', name: 'Rose', bg: 'bg-rose-500', ring: 'ring-rose-400' },
  { id: 'sky', name: 'Sky', bg: 'bg-sky-500', ring: 'ring-sky-400' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-500', ring: 'ring-amber-400' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500', ring: 'ring-indigo-400' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-400' },
];

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      title.value = props.initialTitle;
      subtitle.value = props.initialSubtitle || '';
      color.value = props.initialColor || null;
      layout.value = props.initialLayout || 'list';
      maxTasks.value = props.initialMaxTasks ? String(props.initialMaxTasks) : '';
      isDefault.value = props.initialIsDefault || false;

      nextTick(() => {
        titleInput.value?.focus();
        titleInput.value?.select();
      });
    }
  },
  { immediate: true }
);

const handleDelete = () => {
  emit('delete-column');
  emit('close');
};

const handleSave = () => {
  const cleanTitle = (title.value || '').trim();
  if (!cleanTitle) return;

  const cleanSubtitle = (subtitle.value || '').trim();

  let parsedMaxTasks: number | null = null;
  if (maxTasks.value !== null && maxTasks.value !== undefined && String(maxTasks.value).trim() !== '') {
    const val = String(maxTasks.value).trim();
    if (val === '0') {
      parsedMaxTasks = null;
    } else {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        parsedMaxTasks = parsed;
      }
    }
  }

  emit('save', {
    bucketName: props.bucketName,
    title: cleanTitle,
    subtitle: cleanSubtitle,
    color: color.value,
    layout: layout.value,
    max_tasks: parsedMaxTasks,
    is_default: isDefault.value,
  });
  emit('close');
};

const closeAndSave = () => {
  const cleanTitle = (title.value || '').trim();
  if (cleanTitle) {
    handleSave();
  } else {
    emit('close');
  }
};
</script>

<template>
  <BaseModal :is-open="isOpen" max-width="max-w-md" :title="t('columnEdit.title')" @close="closeAndSave">
    <!-- Form Body -->
    <form @submit.prevent="handleSave" class="p-4 space-y-4">
      <!-- Title Input -->
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
          {{ t('columnEdit.titleLabel') }}
        </label>
        <input
          ref="titleInput"
          v-model="title"
          type="text"
          required
          class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
          :placeholder="t('columnEdit.titlePlaceholder')"
        />
      </div>

      <!-- Subtitle Input -->
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
          {{ t('columnEdit.subtitleLabel') }}
        </label>
        <input
          v-model="subtitle"
          type="text"
          class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring font-sans italic"
          :placeholder="t('columnEdit.subtitlePlaceholder')"
        />
      </div>

      <!-- Max Tasks Limit Input -->
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">
          {{ t('columnEdit.maxTasksLabel') }}
        </label>
        <input
          v-model.number="maxTasks"
          type="number"
          min="1"
          step="1"
          class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
          :placeholder="t('columnEdit.maxTasksPlaceholder')"
        />
      </div>

      <!-- Highlight Color Selector -->
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
          {{ t('columnEdit.colorLabel') }}
        </label>
        <div class="flex flex-wrap gap-2.5 items-center">
          <!-- None Option -->
          <button
            type="button"
            @click="color = null"
            class="w-7 h-7 rounded-full border border-theme-border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 text-theme-text-muted hover:text-theme-text-main"
            :class="[
              color === null
                ? 'ring-2 ring-theme-accent ring-offset-2 ring-offset-theme-base bg-theme-card/80 border-theme-accent/60'
                : 'bg-theme-card/30 hover:bg-theme-card',
            ]"
            :title="t('columnEdit.colorNone')"
          >
            <Slash class="w-3 h-3 shrink-0 rotate-90" />
          </button>

          <!-- Colors -->
          <button
            v-for="c in colors"
            :key="c.id"
            type="button"
            @click="color = c.id"
            class="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95"
            :class="[c.bg, color === c.id ? `ring-2 ring-offset-2 ring-offset-theme-base ${c.ring}` : '']"
            :title="c.name"
          />
        </div>
      </div>

      <!-- Layout Selector -->
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
          {{ t('columnEdit.layoutLabel') }}
        </label>
        <div class="grid grid-cols-3 gap-2 bg-theme-card/40 p-1 rounded border border-theme-border">
          <button
            type="button"
            @click="layout = 'list'"
            class="py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
            :class="
              layout === 'list'
                ? 'bg-theme-primary text-white shadow-sm'
                : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/50'
            "
          >
            {{ t('columnEdit.layoutList') }}
          </button>
          <button
            type="button"
            @click="layout = 'grid-2'"
            class="py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
            :class="
              layout === 'grid-2'
                ? 'bg-theme-primary text-white shadow-sm'
                : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/50'
            "
          >
            {{ t('columnEdit.layoutGrid2') }}
          </button>
          <button
            type="button"
            @click="layout = 'grid-3'"
            class="py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-all cursor-pointer"
            :class="
              layout === 'grid-3'
                ? 'bg-theme-primary text-white shadow-sm'
                : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/50'
            "
          >
            {{ t('columnEdit.layoutGrid3') }}
          </button>
        </div>
      </div>

      <!-- Set as Default Column Checkbox -->
      <div class="pt-2 border-t border-theme-border/50">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            v-model="isDefault"
            class="w-4 h-4 rounded bg-theme-base border-theme-border text-theme-primary focus:ring-theme-primary focus:ring-offset-theme-base cursor-pointer"
          />
          <div class="flex flex-col">
            <span class="text-xs font-semibold text-theme-text-main">{{ t('columnEdit.isDefaultLabel') || 'Default Column' }}</span>
            <span class="text-[10px] text-theme-text-muted">{{
              t('columnEdit.isDefaultHelp') || 'Tasks created without a column will go here.'
            }}</span>
          </div>
        </label>
      </div>
    </form>

    <!-- Footer Buttons -->
    <template #footer>
      <div class="px-4 py-3 border-t border-theme-border flex justify-between items-center bg-theme-card/30 shrink-0">
        <!-- Left Side: Delete Button -->
        <div>
          <button
            type="button"
            @click="handleDelete"
            :disabled="(tasksCount ?? 0) > 0"
            class="text-xs font-semibold px-2.5 py-1.5 rounded border flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
            :class="
              (tasksCount ?? 0) > 0
                ? 'text-theme-text-muted/30 border-theme-border/30 cursor-not-allowed opacity-40'
                : 'text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border-red-500/20'
            "
            :title="(tasksCount ?? 0) > 0 ? t('deleteColumnDisabledTooltip') : t('deleteColumnTooltip')"
          >
            <Trash2 class="w-3.5 h-3.5 shrink-0" />
            {{ t('deleteColumnTooltip') }}
          </button>
        </div>

        <!-- Right Side: Cancel & Save Buttons -->
        <div class="flex gap-2">
          <button
            type="button"
            @click="emit('close')"
            class="text-sm font-semibold px-3 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
          >
            {{ t('buttons.cancel') }}
          </button>
          <button
            type="submit"
            @click="handleSave"
            class="text-sm font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm transition-all cursor-pointer"
            :disabled="!title.trim()"
          >
            {{ t('columnEdit.saveButton') }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
