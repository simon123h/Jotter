<script setup lang="ts">
import { watch, onUnmounted } from 'vue';
import { X } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    isOpen?: boolean;
    title?: string;
    subtitle?: string;
    maxWidth?: string;
    contentClass?: string;
    closeOnBackdrop?: boolean;
    closeOnEsc?: boolean;
    showCloseButton?: boolean;
    teleport?: boolean;
  }>(),
  {
    isOpen: true,
    title: '',
    subtitle: '',
    maxWidth: 'max-w-2xl',
    contentClass: '',
    closeOnBackdrop: true,
    closeOnEsc: true,
    showCloseButton: true,
    teleport: true,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const handleKeyDown = (event: KeyboardEvent) => {
  if (props.closeOnEsc && (event.key === 'Escape' || event.key === 'Esc')) {
    emit('close');
  }
};

watch(
  () => props.isOpen,
  (open) => {
    if (typeof window === 'undefined') return;
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
  }
});

const handleBackdropClick = () => {
  if (props.closeOnBackdrop) {
    emit('close');
  }
};
const isTestEnv = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test';
</script>

<template>
  <Teleport to="body" :disabled="!teleport || isTestEnv">
    <Transition name="modal" appear>
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" @click="handleBackdropClick"></div>

        <!-- Modal Dialog Container -->
        <div
          class="relative bg-theme-base border border-theme-border w-full rounded shadow-2xl overflow-hidden flex flex-col z-10"
          :class="[maxWidth, contentClass]"
          role="dialog"
          aria-modal="true"
        >
          <!-- Header Slot or Default Header -->
          <slot name="header">
            <div
              v-if="title || $slots.title || showCloseButton"
              class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50 shrink-0"
            >
              <div class="flex flex-col min-w-0">
                <slot name="title">
                  <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider truncate">{{ title }}</h3>
                </slot>
                <p v-if="subtitle" class="text-xs text-theme-text-muted mt-0.5 truncate">{{ subtitle }}</p>
              </div>
              <button
                v-if="showCloseButton"
                type="button"
                @click="emit('close')"
                class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer shrink-0 ml-2"
              >
                <X class="w-4 h-4 shrink-0" />
              </button>
            </div>
          </slot>

          <!-- Default Content / Body -->
          <slot></slot>

          <!-- Optional Footer Slot -->
          <slot name="footer"></slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
