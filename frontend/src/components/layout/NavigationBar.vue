<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { Menu, SlidersHorizontal, LayoutGrid, List, Grid, Clock, Plus, Tag, Sparkles, Download } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Project, BucketName } from '@/types';

const { t } = useI18n();
const route = useRoute();

defineProps<{
  modelValue: string; // bound to searchQuery
  isSidebarOpen: boolean;
  projects: Project[];
  activeProjectId: string;
  hasActiveFilters: boolean;
  defaultBucketName: BucketName;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'toggle-sidebar'): void;
  (e: 'open-filter'): void;
  (e: 'create-task', defaultBucket: BucketName): void;
  (e: 'export-tasks', format: 'xlsx' | 'csv'): void;
}>();

const searchInput = ref<HTMLInputElement | null>(null);

const focusSearch = () => {
  searchInput.value?.focus();
  searchInput.value?.select();
};

defineExpose({
  focusSearch,
});

const isTabActive = (tab: string) => {
  const currentMode = (route.meta.backRoute as string) || String(route.name || '');
  return currentMode === tab;
};

// Export Dropdown State & Click-away handling
const showExportMenu = ref(false);

const closeExportMenu = (e: MouseEvent) => {
  const el = e.target as HTMLElement;
  if (!el.closest('.export-dropdown-container')) {
    showExportMenu.value = false;
  }
};

onMounted(() => {
  window.addEventListener('click', closeExportMenu);
});

onUnmounted(() => {
  window.removeEventListener('click', closeExportMenu);
});

const triggerExport = (format: 'xlsx' | 'csv') => {
  showExportMenu.value = false;
  emit('export-tasks', format);
};
</script>

<template>
  <header class="flex items-center justify-between gap-3 border-b border-theme-border px-4 py-3 shrink-0 bg-theme-card z-[110]">
    <div class="flex items-center gap-2.5 overflow-hidden mr-2 shrink-0">
      <!-- Hamburger Menu Button -->
      <button
        @click="emit('toggle-sidebar')"
        class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column rounded transition-all cursor-pointer shrink-0"
        :title="isSidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')"
      >
        <Menu class="w-4 h-4 shrink-0" />
      </button>
      <h1 class="text-base font-bold tracking-tight text-theme-text-main truncate flex items-baseline gap-1.5">
        <router-link :to="{ name: 'home' }" class="hover:text-theme-primary transition-colors cursor-pointer">
          {{ t('brand.title') }}
        </router-link>
        <span class="text-xs font-semibold text-theme-text-muted opacity-80" v-if="projects.find((p) => p.id === activeProjectId)">
          / {{ projects.find((p) => p.id === activeProjectId)?.title }}
        </span>
      </h1>
    </div>

    <!-- Search (Flex-grow to fill remaining space) -->
    <div v-if="activeProjectId" class="flex-grow mx-3 relative">
      <input
        ref="searchInput"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.esc="($event.target as HTMLInputElement).blur()"
        type="text"
        :placeholder="t('searchPlaceholder')"
        class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1 text-xs text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
      />
    </div>
    <div v-else class="flex-grow"></div>

    <!-- Toolbar Actions -->
    <div v-if="activeProjectId" class="flex items-center gap-2 shrink-0">
      <!-- Export Button / Dropdown -->
      <div class="relative shrink-0 export-dropdown-container">
        <button
          @click="showExportMenu = !showExportMenu"
          class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded border border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main transition-all cursor-pointer"
          :title="t('export.buttonTooltip') || 'Export tasks'"
        >
          <Download class="w-3.5 h-3.5 shrink-0" />
          <span class="hidden md:inline">{{ t('export.buttonText') || 'Export' }}</span>
        </button>
        <div
          v-if="showExportMenu"
          class="absolute right-0 mt-1 w-44 bg-theme-base border border-theme-border rounded shadow-lg z-[120] py-1 text-xs"
        >
          <button
            @click="triggerExport('xlsx')"
            class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer"
          >
            {{ t('export.toExcel') || 'Export to Excel (.xlsx)' }}
          </button>
          <button
            @click="triggerExport('csv')"
            class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer"
          >
            {{ t('export.toCSV') || 'Export to CSV (.csv)' }}
          </button>
        </div>
      </div>

      <!-- Advanced Filter Button -->
      <button
        @click="emit('open-filter')"
        class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded border transition-all cursor-pointer"
        :class="
          hasActiveFilters
            ? 'bg-theme-primary/10 border-theme-primary/15 text-theme-accent font-bold shadow-none'
            : 'bg-transparent border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main'
        "
        :title="t('filterModal.buttonTooltip')"
      >
        <SlidersHorizontal class="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
        <span class="hidden md:inline">
          {{ t('filterModal.title') }}
        </span>
        <span
          v-if="hasActiveFilters"
          class="ml-0.5 px-1 bg-theme-primary text-white text-[9px] font-bold rounded-full min-w-[14px] text-center"
        >
          !
        </span>
      </button>

      <!-- View Mode Toggle -->
      <div class="flex items-center bg-theme-column/25 rounded p-0.5 shrink-0 border border-transparent">
        <router-link
          :to="{ name: 'board', params: { projectId: activeProjectId }, query: $route.query }"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
          :class="
            isTabActive('board')
              ? 'bg-theme-primary text-white shadow-none'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
          "
        >
          <LayoutGrid class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('views.board') }}</span>
        </router-link>
        <router-link
          :to="{ name: 'list', params: { projectId: activeProjectId }, query: $route.query }"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
          :class="
            isTabActive('list')
              ? 'bg-theme-primary text-white shadow-none'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
          "
        >
          <List class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('views.list') }}</span>
        </router-link>
        <router-link
          :to="{ name: 'matrix', params: { projectId: activeProjectId }, query: $route.query }"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
          :class="
            isTabActive('matrix')
              ? 'bg-theme-primary text-white shadow-none'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
          "
        >
          <Grid class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('views.matrix') }}</span>
        </router-link>
        <router-link
          :to="{ name: 'tag', params: { projectId: activeProjectId }, query: $route.query }"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
          :class="
            isTabActive('tag')
              ? 'bg-theme-primary text-white shadow-none'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
          "
        >
          <Tag class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('views.tag') }}</span>
        </router-link>
        <router-link
          :to="{ name: 'time', params: { projectId: activeProjectId }, query: $route.query }"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
          :class="
            isTabActive('time')
              ? 'bg-theme-primary text-white shadow-none'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
          "
        >
          <Clock class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('views.time') }}</span>
        </router-link>
        <router-link
          :to="{ name: 'triage', params: { projectId: activeProjectId }, query: $route.query }"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
          :class="
            isTabActive('triage')
              ? 'bg-theme-primary text-white shadow-none'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
          "
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('views.triage') }}</span>
        </router-link>
      </div>

      <!-- New Task Button -->
      <button
        @click="emit('create-task', defaultBucketName)"
        class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded transition-all cursor-pointer shrink-0"
        :title="t('shortcuts.createTask')"
      >
        <Plus class="w-3.5 h-3.5 shrink-0" />
        <span class="hidden sm:inline">{{ t('addTaskButton') }}</span>
      </button>
    </div>
  </header>
</template>
