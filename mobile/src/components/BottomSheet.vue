<script setup lang="ts">
import { X } from '@lucide/vue';
import { t } from '@/i18n';

defineProps<{ title: string; full?: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <div class="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" :aria-label="title">
    <div class="sheet-backdrop absolute inset-0 bg-black/40" data-testid="sheet-backdrop" @click="emit('close')"></div>
    <section
      class="sheet-panel relative flex flex-col rounded-t-2xl border-t border-line bg-card shadow-xl"
      :class="full ? 'h-[94%]' : 'max-h-[85%]'"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <header class="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        <h2 class="truncate text-base font-semibold">{{ title }}</h2>
        <div class="flex items-center gap-1">
          <slot name="actions" />
          <button class="rounded-full p-2 text-muted active:bg-line" :aria-label="t('common.close')" @click="emit('close')">
            <X class="h-5 w-5" />
          </button>
        </div>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <slot />
      </div>
    </section>
  </div>
</template>
