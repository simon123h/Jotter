<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { X } from '@lucide/vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  bucketName: string;
  initialTitle: string;
  initialSubtitle?: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { bucketName: string; title: string; subtitle: string }): void;
}>();

const title = ref('');
const subtitle = ref('');
const titleInput = ref<HTMLInputElement | null>(null);

// Watch for modal open and initialize values
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      title.value = props.initialTitle || '';
      subtitle.value = props.initialSubtitle || '';
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
