<script setup lang="ts">
import { Globe } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';

const { locale, t } = useI18n();
</script>

<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">{{ t('language.label') }}</h3>
    <div class="flex gap-3">
      <button
        @click="locale = 'en'"
        class="flex items-center gap-2.5 px-5 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.02]"
        :class="
          locale === 'en'
            ? 'bg-theme-primary text-white border-theme-primary shadow-md'
            : 'bg-theme-card/60 border-theme-border/60 text-theme-text-card hover:bg-theme-column/30'
        "
      >
        <Globe class="w-4 h-4" />
        <span>{{ t('language.en') }}</span>
      </button>
      <button
        @click="locale = 'de'"
        class="flex items-center gap-2.5 px-5 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.02]"
        :class="
          locale === 'de'
            ? 'bg-theme-primary text-white border-theme-primary shadow-md'
            : 'bg-theme-card/60 border-theme-border/60 text-theme-text-card hover:bg-theme-column/30'
        "
      >
        <Globe class="w-4 h-4" />
        <span>{{ t('language.de') }}</span>
      </button>
    </div>
  </div>
</template>
