<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { FolderInput } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Bucket } from '@/types';

const props = defineProps<{
  buckets: Bucket[];
}>();

const emit = defineEmits<{
  (e: 'pick', bucketName: string): void;
  (e: 'close'): void;
}>();

const { t, tBucket } = useI18n();

// Number keys pick the matching bucket, Escape dismisses
const handleKeyDown = (event: KeyboardEvent) => {
  const num = parseInt(event.key, 10);
  if (num >= 1 && num <= props.buckets.length) {
    event.preventDefault();
    emit('pick', props.buckets[num - 1].name);
  } else if (event.key === 'Escape') {
    emit('close');
  }
};

onMounted(() => window.addEventListener('keydown', handleKeyDown));
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
</script>

<template>
  <div class="absolute inset-0 bg-theme-base/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
    <div class="bg-theme-card border border-theme-border rounded-xl shadow-2xl p-5 max-w-sm w-full space-y-4 animate-scale-in">
      <h3 class="text-sm font-bold text-theme-text-main flex items-center gap-1.5">
        <FolderInput class="w-4 h-4 text-theme-accent" />
        {{ t('triage.columnPopupTitle') }}
      </h3>
      <div class="space-y-1.5">
        <button
          v-for="(b, idx) in buckets"
          :key="b.name"
          @click="emit('pick', b.name)"
          class="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg bg-theme-column/40 hover:bg-theme-column text-sm font-semibold transition-colors border border-theme-border/30 cursor-pointer"
        >
          <span class="truncate">{{ tBucket(b.name, b.title) }}</span>
          <kbd class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-card border border-theme-border text-theme-text-muted">
            {{ idx + 1 }}
          </kbd>
        </button>
      </div>
      <div class="flex justify-end pt-1">
        <button
          @click="emit('close')"
          class="px-3 py-1.5 text-xs font-semibold text-theme-text-muted hover:text-theme-text-main cursor-pointer"
        >
          {{ t('buttons.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./triageAnimations.css"></style>
