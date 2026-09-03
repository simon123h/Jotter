<script setup lang="ts">
import { X } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

defineProps<{
  imageUrl: string | null;
  imageName: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="imageUrl"
        class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 select-none animate-fade-in"
        @click="emit('close')"
      >
        <!-- Header Bar inside Lightbox -->
        <div
          class="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10 pointer-events-auto"
        >
          <span class="text-white text-sm font-semibold truncate max-w-[70%] px-2">{{ imageName }}</span>
          <div class="flex items-center gap-3">
            <a
              :href="imageUrl"
              target="_blank"
              download
              class="text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer flex items-center justify-center"
              :title="t('buttons.download')"
              @click.stop
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
            <button
              @click="emit('close')"
              class="text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer flex items-center justify-center"
              :title="t('buttons.close')"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Main Image Container -->
        <div class="relative max-w-full max-h-[85vh] flex items-center justify-center animate-scale-in" @click.stop>
          <img
            :src="imageUrl"
            :alt="imageName"
            class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-white/10"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
