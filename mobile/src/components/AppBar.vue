<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Menu, Search, ArrowLeft, X, SlidersHorizontal } from '@lucide/vue';
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

const iconButton = 'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink active:bg-line';
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center gap-1 px-1"
    :class="app.selectedCount > 0 ? 'bg-accent/15 text-accent' : 'bg-card'"
    data-testid="app-bar"
  >
    <!-- Tasks are selected: the bar turns into the contextual bar of the selection -->
    <template v-if="app.selectedCount > 0">
      <button :class="iconButton" :aria-label="t('select.clear')" data-testid="clear-selection" @click="app.clearSelection()">
        <X class="h-6 w-6" />
      </button>
      <h1 class="min-w-0 flex-1 truncate px-2 text-[1.35rem] font-normal leading-none" data-testid="selection-count">
        {{ t('select.count', { count: app.selectedCount }) }}
      </h1>
    </template>

    <template v-else-if="!ui.searching">
      <button :class="iconButton" :aria-label="t('nav.menu')" data-testid="open-menu" @click="ui.open({ type: 'drawer' })">
        <Menu class="h-6 w-6" />
      </button>
      <h1 class="min-w-0 flex-1 truncate px-2 text-[1.35rem] font-normal leading-none" data-testid="app-bar-title">{{ title }}</h1>
      <button :class="iconButton" :aria-label="t('common.search')" data-testid="open-search" @click="ui.searching = true">
        <Search class="h-6 w-6" />
        <span
          v-if="app.isFiltering"
          class="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-accent"
          data-testid="filter-active"
        ></span>
      </button>
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
