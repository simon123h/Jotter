<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useToastStore, type ToastType } from '@/stores/toast';
import { useI18n } from '@/composables/useI18n';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from '@lucide/vue';

const { t } = useI18n();
const toastStore = useToastStore();
const { toasts } = storeToRefs(toastStore);

const getToastClasses = (type: ToastType) => {
  switch (type) {
    case 'error':
      return {
        container: 'border-red-500/30 bg-slate-900/95 dark:bg-slate-900/95 text-red-200 shadow-red-500/10',
        icon: AlertCircle,
        iconClass: 'text-red-400',
      };
    case 'success':
      return {
        container: 'border-emerald-500/30 bg-slate-900/95 dark:bg-slate-900/95 text-emerald-200 shadow-emerald-500/10',
        icon: CheckCircle2,
        iconClass: 'text-emerald-400',
      };
    case 'warning':
      return {
        container: 'border-amber-500/30 bg-slate-900/95 dark:bg-slate-900/95 text-amber-200 shadow-amber-500/10',
        icon: AlertTriangle,
        iconClass: 'text-amber-400',
      };
    case 'info':
    default:
      return {
        container: 'border-sky-500/30 bg-slate-900/95 dark:bg-slate-900/95 text-sky-200 shadow-sky-500/10',
        icon: Info,
        iconClass: 'text-sky-400',
      };
  }
};
</script>

<template>
  <div
    class="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none"
    aria-live="polite"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 select-text"
        :class="getToastClasses(toast.type).container"
      >
        <component :is="getToastClasses(toast.type).icon" class="w-5 h-5 shrink-0 mt-0.5" :class="getToastClasses(toast.type).iconClass" />

        <div class="flex-grow min-w-0 pr-1 text-xs">
          <div v-if="toast.title" class="font-bold text-sm text-white mb-0.5 tracking-tight">
            {{ toast.title }}
          </div>
          <div class="leading-relaxed opacity-95 break-words">
            {{ toast.message }}
          </div>
        </div>

        <button
          type="button"
          @click="toastStore.removeToast(toast.id)"
          class="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          :aria-label="t('toast.dismiss')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.95);
}

.toast-move {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
