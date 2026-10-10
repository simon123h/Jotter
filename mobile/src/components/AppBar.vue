<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Menu, Search, ArrowLeft, X, SlidersHorizontal, ListChecks, EllipsisVertical, Check } from '@lucide/vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const input = ref<HTMLInputElement | null>(null);
const title = computed(() => app.project?.title ?? t('app.name'));
const hasExtraFilters = computed(() => !!(app.filter.priority || app.filter.tag));

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
  const column = app.columns[ui.activeColumn];
  if (column) app.selectOnly(column.tasks.map((task) => task.id));
}

const menuOpen = ref(false);
const menuItem = 'flex h-12 w-full items-center gap-3 px-4 text-left text-base active:bg-line';

const viewOptions = computed(() => [
  { id: 'done' as const, label: t('view.hideDone'), on: app.hidden[app.view].done },
  { id: 'archive' as const, label: t('view.hideArchived'), on: app.hidden[app.view].archive },
]);

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
      <button :class="iconButton" :aria-label="t('select.all')" data-testid="select-all" @click="selectAllHere">
        <ListChecks class="h-6 w-6" />
      </button>
    </template>

    <template v-else-if="!ui.searching">
      <button :class="iconButton" :aria-label="t('nav.menu')" data-testid="open-menu" @click="ui.open({ type: 'drawer' })">
        <Menu class="h-6 w-6" />
      </button>
      <h1 class="min-w-0 flex-1 truncate px-2 text-[1.35rem] font-normal leading-7" data-testid="app-bar-title">{{ title }}</h1>
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
            v-for="option in viewOptions"
            :key="option.id"
            :class="menuItem"
            role="menuitemcheckbox"
            :aria-checked="option.on"
            :data-testid="`hide-${option.id}`"
            @click="toggleOption(option.id)"
          >
            <Check class="h-5 w-5 shrink-0" :class="option.on ? 'text-accent' : 'text-transparent'" />{{ option.label }}
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
        v-model="app.filter.search"
        type="search"
        :placeholder="t('filter.search')"
        class="min-w-0 flex-1 bg-transparent px-1 text-lg outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        enterkeyhint="search"
        data-testid="search-input"
      />
      <button
        v-if="app.filter.search"
        :class="iconButton"
        :aria-label="t('search.clear')"
        data-testid="clear-search"
        @click="app.filter.search = ''"
      >
        <X class="h-5 w-5" />
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
