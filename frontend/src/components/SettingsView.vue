<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../composables/useI18n';
import { Settings, Check, Globe } from '@lucide/vue';

const { locale, t } = useI18n();
const settingsStore = useSettingsStore();
const { currentTheme, hideAddTaskButton } = storeToRefs(settingsStore);

const themes = [
  { id: 'midnight', name: 'Midnight Violet', color: 'bg-violet-500' },
  { id: 'forest', name: 'Emerald Forest', color: 'bg-emerald-500' },
  { id: 'frost', name: 'Nordic Frost', color: 'bg-sky-500' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', color: 'bg-pink-500' },
  { id: 'sakura', name: 'Sakura Rose', color: 'bg-rose-500' },
  { id: 'nordic-light', name: 'Nordic Light', color: 'bg-blue-600' },
  { id: 'desert-light', name: 'Desert Amber', color: 'bg-orange-600' },
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
  <div class="h-full w-full overflow-y-auto p-6 bg-transparent scroller-thin flex flex-col gap-6 max-w-4xl mx-auto">
    <div>
      <h2 class="text-xl font-bold tracking-tight text-theme-text-main flex items-center gap-2">
        <Settings class="w-5 h-5 text-theme-accent" />
        {{ t('views.settings') }}
      </h2>
      <p class="text-xs text-theme-text-muted mt-1">Configure your personal preferences, theme aesthetics, and system language.</p>
    </div>

    <div class="border-t border-theme-border/30"></div>

    <!-- Theme Selection Section -->
    <div class="flex flex-col gap-4">
      <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">{{ t('themeLabel') }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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

    <div class="border-t border-theme-border/30"></div>

    <!-- Language Selection Section -->
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
          <span>English</span>
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
          <span>Deutsch</span>
        </button>
      </div>
    </div>

    <div class="border-t border-theme-border/30"></div>

    <!-- General Preferences Section -->
    <div class="flex flex-col gap-4">
      <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">{{ t('settingsView.general') }}</h3>
      <div class="flex flex-col gap-3">
        <label
          class="flex items-start gap-3 p-4 bg-theme-card/60 border border-theme-border/60 rounded-xl cursor-pointer hover:bg-theme-column/30 transition-all select-none"
        >
          <input
            type="checkbox"
            v-model="hideAddTaskButton"
            class="mt-1 w-4 h-4 rounded text-theme-primary border border-theme-border/60 focus:ring-theme-ring focus:ring-2 focus:ring-offset-0 bg-theme-card/60"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-theme-text-main">{{ t('settingsView.hideAddTask') }}</span>
            <span class="text-xs text-theme-text-muted mt-0.5">{{ t('settingsView.hideAddTaskDesc') }}</span>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
