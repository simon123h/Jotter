<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { X, Slash } from '@lucide/vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  bucketName: string;
  initialTitle: string;
  initialSubtitle?: string | null;
  initialColor?: string | null;
  initialLayout?: 'list' | 'grid-2' | 'grid-3';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'save',
    payload: { bucketName: string; title: string; subtitle: string; color: string | null; layout: 'list' | 'grid-2' | 'grid-3' }
  ): void;
}>();

const title = ref('');
const subtitle = ref('');
const color = ref<string | null>(null);
const layout = ref<'list' | 'grid-2' | 'grid-3'>('list');
const titleInput = ref<HTMLInputElement | null>(null);

const colors = [
  { id: 'red', name: 'Red', bg: 'bg-rose-500', ring: 'ring-rose-500' },
  { id: 'orange', name: 'Orange', bg: 'bg-amber-600', ring: 'ring-amber-600' },
  { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-500' },
  { id: 'green', name: 'Green', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
  { id: 'pink', name: 'Pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
];

// Watch for modal open and initialize values
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      title.value = props.initialTitle || '';
      subtitle.value = props.initialSubtitle || '';
      color.value = props.initialColor || null;
      layout.value = props.initialLayout || 'list';
      nextTick(() => {
        titleInput.value?.focus();
      });
    }
  },
  { immediate: true }
);

const handleSave = () => {
  const cleanTitle = (title.value || '').trim();
  const cleanSubtitle = (subtitle.value || '').trim();
  if (!cleanTitle) return;

  emit('save', {
    bucketName: props.bucketName,
    title: cleanTitle,
    subtitle: cleanSubtitle,
    color: color.value,
    layout: layout.value,
  });
  emit('close');
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

        <!-- Modal Content -->
        <div
          class="relative bg-theme-base border border-theme-border w-full max-w-md rounded shadow-2xl overflow-hidden flex flex-col z-10"
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
            <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">{{ t('columnEdit.title') }}</h3>
            <button
              @click="emit('close')"
              class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
            >
              <X class="w-4 h-4 shrink-0" />
            </button>
          </div>

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
                placeholder="e.g. In Progress"
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
                placeholder="Add description..."
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

            <!-- Layout Style Selector -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5">
                {{ t('columnEdit.layoutLabel') }}
              </label>
              <div class="grid grid-cols-3 gap-2 bg-theme-base/40 border border-theme-border rounded p-1">
                <button
                  type="button"
                  @click="layout = 'list'"
                  class="px-2 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  :class="[
                    layout === 'list'
                      ? 'bg-theme-primary text-white shadow-sm font-bold'
                      : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/30',
                  ]"
                >
                  <span>{{ t('columnEdit.layoutList') }}</span>
                </button>
                <button
                  type="button"
                  @click="layout = 'grid-2'"
                  class="px-2 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  :class="[
                    layout === 'grid-2'
                      ? 'bg-theme-primary text-white shadow-sm font-bold'
                      : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/30',
                  ]"
                >
                  <span>{{ t('columnEdit.layoutGrid2') }}</span>
                </button>
                <button
                  type="button"
                  @click="layout = 'grid-3'"
                  class="px-2 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  :class="[
                    layout === 'grid-3'
                      ? 'bg-theme-primary text-white shadow-sm font-bold'
                      : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/30',
                  ]"
                >
                  <span>{{ t('columnEdit.layoutGrid3') }}</span>
                </button>
              </div>
            </div>
          </form>

          <!-- Footer Buttons -->
          <div class="px-4 py-3 border-t border-theme-border flex justify-end gap-2 bg-theme-card/30 shrink-0">
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
      </div>
    </transition>
  </Teleport>
</template>
