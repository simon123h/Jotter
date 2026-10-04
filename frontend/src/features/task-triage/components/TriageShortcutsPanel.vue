<script setup lang="ts">
import { Keyboard, X } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { TRIAGE_SHORTCUT_GROUPS } from '../constants/triageShortcuts';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="w-72 border border-theme-border/60 rounded-xl bg-theme-card/60 backdrop-blur-md p-4 flex flex-col h-full shrink-0 shadow-xl overflow-hidden relative"
  >
    <div class="flex items-center justify-between pb-3 border-b border-theme-border/40 shrink-0">
      <div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-theme-text-main">
        <Keyboard class="w-4 h-4 text-theme-accent shrink-0 animate-pulse" />
        {{ t('triage.shortcutsTitle') }}
      </div>
      <button
        @click="emit('close')"
        class="p-1 rounded hover:bg-theme-column/50 text-theme-text-muted hover:text-theme-text-main cursor-pointer shrink-0"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Shortcuts Scroll Panel list -->
    <div class="flex-grow overflow-y-auto space-y-4 pt-4 scroller-thin min-h-0 text-[11px]">
      <div v-for="group in TRIAGE_SHORTCUT_GROUPS" :key="group.header" class="space-y-2 last:pb-4">
        <h4 class="font-extrabold text-[10px] uppercase tracking-wider text-theme-accent">{{ t(group.header) }}</h4>
        <div class="space-y-1.5">
          <div v-for="item in group.items" :key="item.label" class="flex items-center justify-between py-1 border-b border-theme-border/20">
            <span class="text-theme-text-muted">{{ t(item.label) }}</span>
            <kbd
              class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
              >{{ item.keys }}</kbd
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
