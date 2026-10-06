<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Plus, Search, ChevronDown, RefreshCw, TriangleAlert } from '@lucide/vue';
import TaskCard from '@/components/TaskCard.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const scroller = ref<HTMLElement | null>(null);
const active = computed({
  get: () => ui.activeColumn,
  set: (index: number) => (ui.activeColumn = index),
});
const refreshing = ref(false);

const columnTitle = (key: string, title: string) => (key === '__other' ? t('board.other') : title);

function onScroll() {
  const el = scroller.value;
  if (el && el.clientWidth) active.value = Math.round(el.scrollLeft / el.clientWidth);
}

function goTo(index: number) {
  active.value = index;
  const el = scroller.value;
  if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
}

// A different project starts at its first bucket
watch(
  () => app.projectId,
  async () => {
    active.value = 0;
    await nextTick();
    scroller.value?.scrollTo({ left: 0 });
  }
);

async function refresh() {
  refreshing.value = true;
  try {
    await app.refresh();
  } catch (err) {
    ui.showToast(err instanceof Error ? err.message : String(err));
  } finally {
    refreshing.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" data-testid="board">
    <header class="flex shrink-0 items-center gap-1 px-3 py-2">
      <button
        class="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-left active:bg-line"
        data-testid="open-projects"
        @click="ui.open({ type: 'projects' })"
      >
        <span class="truncate text-lg font-semibold">{{ app.project?.title ?? t('projects.title') }}</span>
        <ChevronDown class="h-5 w-5 shrink-0 text-muted" />
      </button>
      <span class="flex-1"></span>
      <button
        class="relative rounded-full p-2.5 active:bg-line"
        :aria-label="t('common.search')"
        data-testid="open-filter"
        @click="ui.open({ type: 'filter' })"
      >
        <Search class="h-5 w-5" />
        <span
          v-if="app.isFiltering"
          class="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent"
          data-testid="filter-active"
        ></span>
      </button>
      <button class="rounded-full p-2.5 active:bg-line" :aria-label="t('board.refresh')" data-testid="refresh" @click="refresh">
        <RefreshCw class="h-5 w-5" :class="{ 'animate-spin': refreshing }" />
      </button>
    </header>

    <div
      v-if="app.unreadable.length"
      class="mx-3 mb-2 flex items-start gap-2 rounded-lg bg-amber-500/15 p-2 text-xs"
      data-testid="unreadable-banner"
    >
      <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{{ app.unreadable.length }} file(s) could not be read and were left untouched.</span>
    </div>

    <!-- No project yet -->
    <main v-if="!app.project" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center" data-testid="no-projects">
      <h2 class="text-lg font-semibold">{{ t('board.noProjects') }}</h2>
      <p class="text-sm text-muted">{{ t('board.noProjectsHint') }}</p>
      <button class="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink" @click="ui.open({ type: 'projects' })">
        {{ t('board.createProject') }}
      </button>
    </main>

    <template v-else>
      <nav class="flex shrink-0 gap-2 overflow-x-auto px-3 pb-2" aria-label="Buckets">
        <button
          v-for="(col, i) in app.columns"
          :key="col.key"
          class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium"
          :class="i === active ? 'bg-accent text-accent-ink' : 'bg-line/70 text-muted'"
          data-testid="bucket-tab"
          @click="goTo(i)"
        >
          {{ columnTitle(col.key, col.title) }} <span class="opacity-70">{{ col.tasks.length }}</span>
        </button>
      </nav>

      <div
        ref="scroller"
        class="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
        data-testid="columns"
        @scroll.passive="onScroll"
      >
        <section
          v-for="col in app.columns"
          :key="col.key"
          class="h-full w-full shrink-0 snap-center overflow-y-auto px-3 pb-24"
          data-testid="column"
        >
          <ul class="space-y-2">
            <li v-for="task in col.tasks" :key="task.id">
              <TaskCard :task="task" @open="ui.open({ type: 'task', id: task.id })" />
            </li>
          </ul>
          <p v-if="!col.tasks.length" class="pt-10 text-center text-sm text-muted">
            {{ app.isFiltering ? t('board.noMatches') : t('board.emptyBucket') }}
          </p>
        </section>
      </div>

      <button
        class="fixed bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg active:scale-95"
        style="margin-bottom: env(safe-area-inset-bottom)"
        :aria-label="t('task.new')"
        data-testid="fab"
        @click="ui.open({ type: 'quickadd' })"
      >
        <Plus class="h-7 w-7" />
      </button>
    </template>
  </div>
</template>
