<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Plus, RefreshCw, TriangleAlert } from '@lucide/vue';
import AppBar from '@/components/AppBar.vue';
import ColumnTabs from '@/components/ColumnTabs.vue';
import TaskCard from '@/components/TaskCard.vue';
import { useCardDrag } from '@/composables/useCardDrag';
import { usePullToRefresh } from '@/composables/usePullToRefresh';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import type { Task } from '@jotter/vault-format';

const app = useAppStore();
const ui = useUiStore();

const scroller = ref<HTMLElement | null>(null);
const active = computed({
  get: () => ui.activeColumn,
  set: (index: number) => (ui.activeColumn = index),
});

const drag = useCardDrag({
  scroller,
  siblings: (bucket, excludeId) => app.positionsIn(bucket, excludeId),
  move: (id, bucket, position) => app.moveTask(id, bucket, position),
  onError: (err) => ui.showToast(err instanceof Error ? err.message : String(err)),
});

/**
 * The card being dragged is drawn under the finger instead of in the list. Its element must stay in the page,
 * though: the browser cancels a touch gesture when the element it started on goes away.
 */
const isDragged = (task: Task) => task.id === drag.dragging.value?.id;
const shown = (tasks: Task[]) => tasks.filter((t) => !isDragged(t));
const dropIndex = (key: string) => (drag.target.value?.columnKey === key ? drag.target.value.index : -1);

function openTask(id: string) {
  if (!drag.consumeClick()) ui.open({ type: 'task', id });
}

function onScroll() {
  const el = scroller.value;
  if (!el || !el.clientWidth) return;
  const position = el.scrollLeft / el.clientWidth;
  ui.columnProgress = position;
  active.value = Math.round(position);
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
    ui.columnProgress = 0;
    await nextTick();
    scroller.value?.scrollTo({ left: 0 });
  }
);

async function refresh() {
  try {
    await app.refresh();
  } catch (err) {
    ui.showToast(err instanceof Error ? err.message : String(err));
  }
}

const pullRefresh = usePullToRefresh(scroller, { onRefresh: refresh, disabled: () => !!drag.dragging.value });
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" data-testid="board">
    <AppBar />

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
      <button
        class="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink"
        data-testid="create-first-project"
        @click="ui.open({ type: 'projects' })"
      >
        {{ t('board.createProject') }}
      </button>
    </main>

    <template v-else>
      <ColumnTabs @select="goTo" />

      <!-- Pull-to-refresh indicator: grows with the pull and sits above the columns -->
      <div
        v-if="pullRefresh.pull.value > 0"
        class="flex shrink-0 items-center justify-center overflow-hidden text-muted"
        :style="{ height: `${pullRefresh.pull.value}px` }"
        :data-refreshing="pullRefresh.refreshing.value"
        data-testid="pull-indicator"
      >
        <RefreshCw
          class="h-5 w-5"
          :class="{ 'animate-spin': pullRefresh.refreshing.value }"
          :style="{ transform: `rotate(${pullRefresh.pull.value * 3}deg)` }"
        />
      </div>

      <div
        ref="scroller"
        class="flex min-h-0 flex-1 overflow-x-auto"
        :class="drag.dragging.value ? 'snap-none' : 'snap-x snap-mandatory'"
        data-testid="columns"
        @scroll.passive="onScroll"
      >
        <section
          v-for="col in app.columns"
          :key="col.key"
          class="h-full w-full shrink-0 snap-center overflow-y-auto overscroll-y-contain px-3 pb-24 pt-3"
          :data-column="col.key"
          :data-bucket="col.bucket ?? undefined"
          data-testid="column"
        >
          <ul class="space-y-2">
            <template v-for="task in col.tasks" :key="task.id">
              <li
                v-if="!isDragged(task) && dropIndex(col.key) === shown(col.tasks).indexOf(task)"
                class="h-1 rounded-full bg-accent"
                data-testid="drop-line"
              ></li>
              <li
                :data-task-id="task.id"
                :class="isDragged(task) ? 'pointer-events-none invisible fixed' : ''"
                @pointerdown="drag.onPointerDown($event, task)"
                @contextmenu.prevent
              >
                <TaskCard :task="task" @open="openTask(task.id)" />
              </li>
            </template>
            <li v-if="dropIndex(col.key) >= shown(col.tasks).length" class="h-1 rounded-full bg-accent" data-testid="drop-line"></li>
          </ul>
          <p v-if="!col.tasks.length" class="pt-10 text-center text-sm text-muted">
            {{ app.isFiltering ? t('board.noMatches') : t('board.emptyBucket') }}
          </p>
        </section>
      </div>

      <!-- The card being dragged, under the finger -->
      <div
        v-if="drag.dragging.value"
        class="pointer-events-none fixed z-30 rotate-1 scale-105 opacity-95 shadow-2xl"
        :style="{
          left: `${drag.ghost.value.x - drag.ghost.value.offsetX}px`,
          top: `${drag.ghost.value.y - drag.ghost.value.offsetY}px`,
          width: `${drag.ghost.value.width}px`,
        }"
        data-testid="drag-ghost"
      >
        <TaskCard :task="drag.dragging.value" />
      </div>

      <button
        class="fixed bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg shadow-black/25 active:scale-95"
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
