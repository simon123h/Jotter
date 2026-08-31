<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  Menu,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Grid,
  Clock,
  Plus,
  Tag,
  Sparkles,
  MoreVertical,
  FileSpreadsheet,
  FileText,
  Box,
} from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Project, BucketName } from '@/types';

const { t } = useI18n();
const route = useRoute();

defineProps<{
  modelValue: string; // bound to searchQuery
  isSidebarOpen: boolean;
  isTimeboxSidebarOpen?: boolean;
  projects: Project[];
  activeProjectId: string;
  hasActiveFilters: boolean;
  defaultBucketName: BucketName;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'toggle-sidebar'): void;
  (e: 'toggle-timebox-sidebar'): void;
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

// Overflow Menu State & Click-away handling
const showOverflowMenu = ref(false);

const closeOverflowMenu = (e: MouseEvent) => {
  const el = e.target as HTMLElement;
  if (el && typeof el.closest === 'function') {
    if (!el.closest('.overflow-menu-container')) {
      showOverflowMenu.value = false;
    }
  } else {
    showOverflowMenu.value = false;
  }
};

onMounted(() => {
  window.addEventListener('click', closeOverflowMenu);
});

onUnmounted(() => {
  window.removeEventListener('click', closeOverflowMenu);
});

const triggerExport = (format: 'xlsx' | 'csv') => {
  showOverflowMenu.value = false;
  emit('export-tasks', format);
};
</script>

<template>
  <header class="flex items-center justify-between gap-3 border-b border-theme-border px-4 py-3 shrink-0 bg-theme-card z-[110]">
    <div class="flex items-center gap-2.5 overflow-hidden mr-2 min-w-0">
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
    <div v-if="activeProjectId" class="flex-grow mx-3 relative min-w-[100px] sm:min-w-[180px] lg:min-w-[280px]">
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
        <span class="hidden lg:inline">
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
      <div class="hidden lg:flex items-center bg-theme-column/25 rounded p-0.5 shrink-0 border border-transparent">
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

      <!-- Timebox Sidebar Toggle Button -->
      <button
        @click="emit('toggle-timebox-sidebar')"
        class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded border transition-all cursor-pointer"
        :class="
          isTimeboxSidebarOpen
            ? 'bg-theme-primary/15 border-theme-primary/25 text-theme-accent font-bold shadow-2xs'
            : 'bg-transparent border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main'
        "
        :title="t('timebox.toggleSidebarTooltip')"
      >
        <Box class="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
        <span class="hidden xl:inline">
          {{ t('timebox.sidebarTitle') }}
        </span>
      </button>

      <!-- Overflow Menu (Three dots) -->
      <div class="relative shrink-0 overflow-menu-container">
        <button
          @click="showOverflowMenu = !showOverflowMenu"
          class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 rounded transition-all cursor-pointer"
          :title="t('overflowMenu.title') || 'More options'"
        >
          <MoreVertical class="w-4 h-4 shrink-0" />
        </button>
        <div
          v-if="showOverflowMenu"
          class="absolute right-0 mt-1 w-48 bg-theme-base border border-theme-border rounded shadow-lg z-[120] py-1 text-xs"
        >
          <!-- Views Section (only visible on mobile/small screens < lg) -->
          <div class="lg:hidden">
            <div
              class="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-theme-text-muted border-b border-theme-border/50 mb-1"
            >
              {{ t('overflowMenu.views') || 'Views' }}
            </div>
            <router-link
              :to="{ name: 'board', params: { projectId: activeProjectId }, query: $route.query }"
              class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
              :class="{ 'text-theme-primary bg-theme-primary/5': isTabActive('board') }"
              @click="showOverflowMenu = false"
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span>{{ t('views.board') }}</span>
            </router-link>
            <router-link
              :to="{ name: 'list', params: { projectId: activeProjectId }, query: $route.query }"
              class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
              :class="{ 'text-theme-primary bg-theme-primary/5': isTabActive('list') }"
              @click="showOverflowMenu = false"
            >
              <List class="w-3.5 h-3.5" />
              <span>{{ t('views.list') }}</span>
            </router-link>
            <router-link
              :to="{ name: 'matrix', params: { projectId: activeProjectId }, query: $route.query }"
              class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
              :class="{ 'text-theme-primary bg-theme-primary/5': isTabActive('matrix') }"
              @click="showOverflowMenu = false"
            >
              <Grid class="w-3.5 h-3.5" />
              <span>{{ t('views.matrix') }}</span>
            </router-link>
            <router-link
              :to="{ name: 'tag', params: { projectId: activeProjectId }, query: $route.query }"
              class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
              :class="{ 'text-theme-primary bg-theme-primary/5': isTabActive('tag') }"
              @click="showOverflowMenu = false"
            >
              <Tag class="w-3.5 h-3.5" />
              <span>{{ t('views.tag') }}</span>
            </router-link>
            <router-link
              :to="{ name: 'time', params: { projectId: activeProjectId }, query: $route.query }"
              class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
              :class="{ 'text-theme-primary bg-theme-primary/5': isTabActive('time') }"
              @click="showOverflowMenu = false"
            >
              <Clock class="w-3.5 h-3.5" />
              <span>{{ t('views.time') }}</span>
            </router-link>
            <router-link
              :to="{ name: 'triage', params: { projectId: activeProjectId }, query: $route.query }"
              class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
              :class="{ 'text-theme-primary bg-theme-primary/5': isTabActive('triage') }"
              @click="showOverflowMenu = false"
            >
              <Sparkles class="w-3.5 h-3.5" />
              <span>{{ t('views.triage') }}</span>
            </router-link>
            <div class="border-t border-theme-border/50 my-1"></div>
          </div>

          <div class="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-theme-text-muted border-b border-theme-border/50 mb-1">
            {{ t('export.buttonText') || 'Export' }}
          </div>
          <button
            @click="triggerExport('xlsx')"
            class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
          >
            <FileSpreadsheet class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {{ t('export.toExcel') || 'Export to Excel (.xlsx)' }}
          </button>
          <button
            @click="triggerExport('csv')"
            class="w-full text-left px-3 py-1.5 hover:bg-theme-column/25 text-theme-text-main font-semibold cursor-pointer flex items-center gap-2"
          >
            <FileText class="w-3.5 h-3.5 text-blue-500 shrink-0" />
            {{ t('export.toCSV') || 'Export to CSV (.csv)' }}
          </button>
        </div>
      </div>

      <!-- New Task Button -->
      <button
        @click="emit('create-task', defaultBucketName)"
        class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded transition-all cursor-pointer shrink-0"
        :title="t('shortcuts.createTask')"
      >
        <Plus class="w-3.5 h-3.5 shrink-0" />
        <span class="hidden lg:inline">{{ t('addTaskButton') }}</span>
      </button>
    </div>
  </header>
</template>
