<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  Menu,
  Search,
  ArrowLeft,
  X,
  SlidersHorizontal,
  ListChecks,
  EllipsisVertical,
  Check,
  ChevronDown,
  Calendar,
  Bookmark,
} from '@lucide/vue';
import { isEmptyFilter, scopedQuery } from '@jotter/task-filter';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import ColumnTargets from '@/components/ColumnTargets.vue';

const app = useAppStore();
const ui = useUiStore();

const input = ref<HTMLInputElement | null>(null);
const title = computed(() => app.activeView?.name ?? app.project?.title ?? t('app.name'));
/** The query asks for more than words: the filter button shows a dot. */
const hasExtraFilters = computed(() => !isEmptyFilter({ ...app.parsedFilter, search: undefined }));

// The search field takes the place of the title; focus it as soon as it is there
watch(
  () => ui.searching,
  async (searching) => {
    if (!searching) return;
    await nextTick();
    input.value?.focus();
  }
);

/** Closing the search drops every filter, as the back arrow of a Material search bar does. */
function closeSearch() {
  app.resetFilter();
  ui.searching = false;
}

function selectAllHere() {
  // The list shows every column at once, the tabs one of them
  const columns = app.layout === 'list' ? app.columns : app.columns.slice(ui.activeColumn, ui.activeColumn + 1);
  app.selectOnly([...new Set(columns.flatMap((column) => column.tasks.map((task) => task.id)))]);
}

/** The column in view in the tabs layout: the list layout has the buttons in the section headers. */
const columnInView = computed(() => (app.layout === 'tabs' ? app.columns[ui.activeColumn] : undefined));

const menuOpen = ref(false);
const menuItem = 'flex h-12 w-full items-center gap-3 px-4 text-left text-base active:bg-line';

const viewOptions = computed(() => [
  { id: 'done' as const, label: t('view.hideDone'), on: app.hidden[app.view].done },
  { id: 'archive' as const, label: t('view.hideArchived'), on: app.hidden[app.view].archive },
]);

function openHorizon() {
  menuOpen.value = false;
  ui.open({ type: 'horizon' });
}

function toggleLayout() {
  menuOpen.value = false;
  app.setLayout(app.layout === 'list' ? 'tabs' : 'list');
}

function toggleOption(id: 'done' | 'archive') {
  menuOpen.value = false;
  app.toggleHidden(id);
}

const iconButton = 'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink active:bg-line';
</script>

<template>
  <header
    class="relative flex h-14 shrink-0 items-center gap-1 px-1"
    :class="app.selectedCount > 0 ? 'bg-accent/15 text-accent' : 'bg-card'"
    data-testid="app-bar"
  >
    <!-- Tasks are selected: the bar turns into the contextual bar of the selection -->
    <template v-if="app.selectedCount > 0">
      <button :class="iconButton" :aria-label="t('select.clear')" data-testid="clear-selection" @click="app.clearSelection()">
        <X class="h-6 w-6" />
      </button>
      <h1 class="min-w-0 flex-1 truncate px-2 text-[1.35rem] font-normal leading-7" data-testid="selection-count">
        {{ t('select.count', { count: app.selectedCount }) }}
      </h1>
      <ColumnTargets v-if="columnInView" :column="columnInView" size="bar" />
      <button :class="iconButton" :aria-label="t('select.all')" data-testid="select-all" @click="selectAllHere">
        <ListChecks class="h-6 w-6" />
      </button>
    </template>

    <template v-else-if="!ui.searching">
      <button :class="iconButton" :aria-label="t('nav.menu')" data-testid="open-menu" @click="ui.open({ type: 'drawer' })">
        <Menu class="h-6 w-6" />
      </button>
      <!-- The title is the project switcher: it opens the list of projects -->
      <h1 class="min-w-0 flex-1 text-[1.35rem] font-normal leading-7" data-testid="app-bar-title">
        <button
          class="flex h-12 max-w-full items-center gap-1 rounded-full px-2 active:bg-line"
          :aria-label="t('projects.switch')"
          aria-haspopup="dialog"
          data-testid="open-projects"
          @click="ui.open({ type: 'project-switch' })"
        >
          <span class="truncate">{{ title }}</span>
          <ChevronDown class="h-5 w-5 shrink-0 text-muted" />
        </button>
      </h1>
      <button :class="iconButton" :aria-label="t('common.search')" data-testid="open-search" @click="ui.searching = true">
        <Search class="h-6 w-6" />
        <span
          v-if="app.isFiltering"
          class="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-accent"
          data-testid="filter-active"
        ></span>
      </button>
      <button
        :class="iconButton"
        :aria-label="t('common.moreActions')"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        data-testid="view-menu"
        @click="menuOpen = !menuOpen"
      >
        <EllipsisVertical class="h-6 w-6" />
      </button>
      <template v-if="menuOpen">
        <div class="fixed inset-0 z-10" data-testid="view-menu-scrim" @click="menuOpen = false"></div>
        <div
          class="absolute right-2 top-12 z-20 w-64 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-xl"
          role="menu"
          data-testid="view-menu-list"
        >
          <button
            :class="menuItem"
            role="menuitemcheckbox"
            :aria-checked="app.layout === 'list'"
            data-testid="layout-list"
            @click="toggleLayout"
          >
            <Check class="h-5 w-5 shrink-0" :class="app.layout === 'list' ? 'text-accent' : 'text-transparent'" />
            <span class="min-w-0 flex-1 truncate">{{ t('view.asList') }}</span>
          </button>
          <div class="my-1 border-t border-line"></div>
          <button
            v-for="option in viewOptions"
            :key="option.id"
            :class="menuItem"
            role="menuitemcheckbox"
            :aria-checked="option.on"
            :data-testid="`hide-${option.id}`"
            @click="toggleOption(option.id)"
          >
            <Check class="h-5 w-5 shrink-0" :class="option.on ? 'text-accent' : 'text-transparent'" />
            <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          </button>
          <!-- The planning view looks ahead by nature: it has no horizon -->
          <button
            v-if="app.view !== 'planning'"
            class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-line"
            role="menuitem"
            data-testid="open-horizon"
            @click="openHorizon"
          >
            <Calendar class="h-5 w-5 shrink-0 text-muted" />
            <!-- Two lines read as one sentence: "Show planned tasks… up to today · 3 hidden" -->
            <span class="min-w-0 flex-1">
              <span class="block truncate text-base">{{ t('view.horizon') }}</span>
              <span class="block truncate text-sm text-muted"
                >{{ t(`horizon.upTo.${app.horizon}` as MessageKey)
                }}{{ app.beyondCount ? ' · ' + t('horizon.hidden', { count: app.beyondCount }) : '' }}</span
              >
            </span>
          </button>
        </div>
      </template>
    </template>

    <template v-else>
      <button :class="iconButton" :aria-label="t('search.close')" data-testid="close-search" @click="closeSearch">
        <ArrowLeft class="h-6 w-6" />
      </button>
      <input
        ref="input"
        v-model="app.query"
        type="search"
        :placeholder="t('filter.search')"
        class="min-w-0 flex-1 bg-transparent px-1 text-lg outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        enterkeyhint="search"
        data-testid="search-input"
      />
      <button v-if="app.query" :class="iconButton" :aria-label="t('search.clear')" data-testid="clear-search" @click="app.query = ''">
        <X class="h-5 w-5" />
      </button>
      <button
        v-if="app.query && !app.scoped"
        :class="iconButton"
        :aria-label="t('views.save')"
        data-testid="save-view"
        @click="ui.open({ type: 'view', query: scopedQuery(app.query, app.projectId) })"
      >
        <Bookmark class="h-5 w-5" />
      </button>
      <button :class="iconButton" :aria-label="t('search.filters')" data-testid="open-filter" @click="ui.open({ type: 'filter' })">
        <SlidersHorizontal class="h-5 w-5" />
        <span
          v-if="hasExtraFilters"
          class="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-accent"
          data-testid="filter-active"
        ></span>
      </button>
    </template>
  </header>
</template>
