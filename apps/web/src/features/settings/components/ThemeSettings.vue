<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { Check } from '@lucide/vue';
import { useSettingsStore } from '@/stores/settings';
import { THEMES } from '@jotter/themes';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const { currentTheme, themeFollowsSystem, lightTheme, darkTheme } = storeToRefs(settingsStore);

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
};

const lightThemes = THEMES.filter((th) => !th.dark);
const darkThemes = THEMES.filter((th) => th.dark);
const select = 'bg-theme-card border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text-main outline-none';
</script>

<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">{{ t('themeLabel') }}</h3>
    <label class="flex items-center gap-2 text-xs text-theme-text-main cursor-pointer">
      <input v-model="themeFollowsSystem" type="checkbox" data-testid="theme-follows-system" />
      {{ t('themeFollowSystem') }}
    </label>
    <div v-if="themeFollowsSystem" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-theme-text-muted">
        {{ t('themeWhenLight') }}
        <select v-model="lightTheme" :class="select" data-testid="theme-light">
          <option v-for="th in lightThemes" :key="th.id" :value="th.id">{{ t('themeNames.' + th.id) }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-theme-text-muted">
        {{ t('themeWhenDark') }}
        <select v-model="darkTheme" :class="select" data-testid="theme-dark">
          <option v-for="th in darkThemes" :key="th.id" :value="th.id">{{ t('themeNames.' + th.id) }}</option>
        </select>
      </label>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
