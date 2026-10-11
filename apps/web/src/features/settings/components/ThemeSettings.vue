<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { Check } from '@lucide/vue';
import { useSettingsStore } from '@/stores/settings';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const { currentTheme } = storeToRefs(settingsStore);

const themes = [
  { id: 'nordic-light', name: 'Nordic Light', color: 'bg-blue-600' },
  { id: 'desert-light', name: 'Desert Amber', color: 'bg-orange-600' },
  { id: 'earth-light', name: 'Earth & Moss', color: 'bg-emerald-700' },
  { id: 'frost', name: 'Nordic Frost', color: 'bg-sky-500' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', color: 'bg-pink-500' },
  { id: 'midnight', name: 'Midnight Violet', color: 'bg-violet-500' },
  { id: 'forest', name: 'Emerald Forest', color: 'bg-emerald-500' },
  { id: 'sakura', name: 'Sakura Rose', color: 'bg-rose-500' },
  { id: 'true-black', name: 'True Black', color: 'bg-black ring-1 ring-white/40' },
];

const setTheme = (theme: string) => {
  settingsStore.setTheme(theme);
  const docClasses = document.documentElement.classList;
  // Remove existing themes
  docClasses.forEach((c) => {
    if (c.startsWith('theme-')) {
      docClasses.remove(c);
    }
  });
  if (theme !== 'nordic-light') {
    docClasses.add('theme-' + theme);
  }
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">{{ t('themeLabel') }}</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      <button
        v-for="th in themes"
        :key="th.id"
        @click="setTheme(th.id)"
        class="flex items-center gap-3 p-3.5 border rounded-xl transition-all duration-300 cursor-pointer text-left hover:scale-[1.02]"
        :class="
          currentTheme === th.id
            ? 'bg-theme-primary/10 border-theme-accent text-theme-accent shadow-md'
            : 'bg-theme-card/60 border-theme-border/60 text-theme-text-card hover:bg-theme-column/30'
        "
      >
        <span class="w-4 h-4 rounded-full shrink-0 shadow-inner" :class="th.color"></span>
        <div class="flex-grow">
          <div class="text-xs font-bold">{{ t('themeNames.' + th.id) }}</div>
        </div>
        <Check v-if="currentTheme === th.id" class="w-4 h-4 text-theme-primary shrink-0" />
      </button>
    </div>
  </div>
</template>
