<script setup lang="ts">
import { useDialog } from '@/composables/useDialog';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info } from '@lucide/vue';

const { isOpen, title, message, type, confirmText, cancelText, showCancel, handleConfirm, handleCancel } = useDialog();
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
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
            <CheckCircle2 v-if="type === 'success'" class="w-6 h-6" />
            <AlertOctagon v-else-if="type === 'error'" class="w-6 h-6" />
            <AlertTriangle v-else-if="type === 'warning'" class="w-6 h-6" />
            <Info v-else class="w-6 h-6" />
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
              class="flex-1 text-xs font-semibold py-1.5 px-3 bg-theme-base hover:bg-theme-column/60 border border-theme-border rounded transition-all cursor-pointer"
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
    </transition>
  </Teleport>
</template>
