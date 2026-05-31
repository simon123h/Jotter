<script setup lang="ts">
import { useDialog } from '../composables/useDialog';

const { isOpen, title, message, type, confirmText, cancelText, showCancel, handleConfirm, handleCancel } = useDialog();
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-[2px] transition-opacity" @click="handleCancel"></div>

    <!-- Dialog container -->
    <div
      class="relative bg-theme-card border border-theme-border w-full max-w-xs sm:max-w-sm rounded shadow-2xl p-5 z-10 flex flex-col items-center text-center transform scale-100 transition-all"
    >
      <!-- Icon representation -->
      <div
        class="w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm"
        :class="{
          'bg-emerald-500/10 text-emerald-500': type === 'success',
          'bg-red-500/10 text-red-500': type === 'error',
          'bg-amber-500/10 text-amber-500': type === 'warning',
          'bg-theme-primary/10 text-theme-accent': type === 'info',
        }"
      >
        <!-- Success Check Icon -->
        <svg v-if="type === 'success'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <!-- Error Icon -->
        <svg v-else-if="type === 'error'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <!-- Warning Icon -->
        <svg v-else-if="type === 'warning'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <!-- Info Icon -->
        <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <!-- Title & Message -->
      <h3 v-if="title" class="text-sm font-bold text-theme-text-main mb-1.5 tracking-wide uppercase">
        {{ title }}
      </h3>
      <p class="text-theme-text-muted text-xs leading-relaxed mb-4 max-w-[260px] break-words">
        {{ message }}
      </p>

      <!-- Action Buttons -->
      <div class="flex items-center justify-center gap-2 w-full">
        <button
          v-if="showCancel"
          type="button"
          @click="handleCancel"
          class="flex-1 text-xs font-semibold py-1.5 px-3 bg-theme-base hover:bg-theme-column/60 text-slate-200 border border-theme-border rounded transition-all cursor-pointer"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          @click="handleConfirm"
          class="text-xs font-semibold py-1.5 px-3 text-white rounded shadow-sm transition-all cursor-pointer"
          :class="[
            showCancel ? 'flex-1' : 'w-24',
            type === 'error'
              ? 'bg-red-600 hover:bg-red-500'
              : type === 'warning'
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-theme-primary hover:bg-theme-primary-hover',
          ]"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>
