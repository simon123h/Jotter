<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { Plus, TriangleAlert } from '@lucide/vue';
import AppBar from '@/components/AppBar.vue';
import BottomNav from '@/components/BottomNav.vue';
import BulkToolbar from '@/components/BulkToolbar.vue';
import ColumnTabs from '@/components/ColumnTabs.vue';
import TaskRow from '@/components/TaskRow.vue';
import { useCardDrag } from '@/composables/useCardDrag';
import { useTaskActions } from '@/composables/useTaskActions';
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

const actions = useTaskActions();

const drag = useCardDrag({
  scroller,
  siblings: (bucket, excludeId) => app.positionsIn(bucket, excludeId),
  move: async (id, bucket, position) => {
    const before = app.taskById(id);
    await app.moveTask(id, bucket, position);
    if (before) actions.announceMove(id, { bucket: before.bucket, position: before.position }, bucket);
  },
  onHoldRelease: (task) => app.toggleSelected(task.id),
  onError: (err) => ui.showToast(err instanceof Error ? err.message : String(err)),
  // The order of tasks belongs to the board's columns
  canReorder: () => app.view === 'board',
});

/**
 * The card being dragged is drawn under the finger instead of in the list. Its element must stay in the page,
 * though: the browser cancels a touch gesture when the element it started on goes away.
 */
const isDragged = (task: Task) => task.id === drag.dragging.value?.id;
const shown = (tasks: Task[]) => tasks.filter((t) => !isDragged(t));
const dropIndex = (key: string) => (drag.target.value?.columnKey === key ? drag.target.value.index : -1);

/** The tasks a swipe on `task` acts on: all selected ones when it is one of several, otherwise just itself. */
const targets = (task: Task) => (app.isSelected(task.id) && app.selectedCount > 1 ? [...app.selection] : [task.id]);
const bulkCount = (task: Task) => (app.isSelected(task.id) ? app.selectedCount : 0);

/** Where a swipe to the left leads: the column picker on the board, the planned dates or the tags in the other views. */
const leftAction = computed(() => (app.view === 'planning' ? 'planned' : app.view === 'tags' ? 'tags' : 'move'));
function onSwipeLeft(task: Task) {
  const ids = targets(task);
  if (leftAction.value === 'planned') ui.open({ type: 'bulk-planned', ids });
  else if (leftAction.value === 'tags') ui.open({ type: 'bulk-tags', ids });
  else ui.open({ type: 'move', ids });
}

/** A tap opens a task, or ticks it while others are selected. */
function onTap(task: Task) {
  if (drag.consumeClick()) return;
  if (app.selectedCount > 0) app.toggleSelected(task.id);
  else ui.open({ type: 'task', id: task.id });
}

/** Scrolling down clears the navigation bar away, scrolling up (or reaching the top) brings it back. */
const lastTop = new WeakMap<Element, number>();
function onListScroll(e: Event) {
  const el = e.currentTarget as HTMLElement;
  const top = el.scrollTop;
  const delta = top - (lastTop.get(el) ?? 0);
  lastTop.set(el, top);
  if (top <= 0 || delta < -6) ui.navHidden = false;
  else if (delta > 6) ui.navHidden = true;
}

/**
 * A hard flick must move one column, not several. `snap-always` asks the browser for that, but a WebView's momentum
 * can still carry past it, so a swipe also holds the scroll within one column of where the finger went down.
 */
let swipeFrom: number | null = null;
let swipeIdle: ReturnType<typeof setTimeout> | undefined;

function onTouchStart() {
  const el = scroller.value;
  if (!el?.clientWidth || ui.dragging) return;
  clearTimeout(swipeIdle);
  swipeFrom = Math.round(el.scrollLeft / el.clientWidth);
}

function holdWithinOneColumn(el: HTMLElement) {
  if (swipeFrom === null || ui.dragging) return;
  const lowest = Math.max(swipeFrom - 1, 0) * el.clientWidth;
  const highest = Math.min(swipeFrom + 1, Math.max(app.columns.length - 1, 0)) * el.clientWidth;
  if (el.scrollLeft < lowest) el.scrollLeft = lowest;
  else if (el.scrollLeft > highest) el.scrollLeft = highest;
  // The swipe is over once the column has stopped moving
  clearTimeout(swipeIdle);
  swipeIdle = setTimeout(() => (swipeFrom = null), 200);
}

let pagingIdle: ReturnType<typeof setTimeout> | undefined;

onBeforeUnmount(() => {
  clearTimeout(pagingIdle);
  ui.paging = false;
});

function onScroll() {
  const el = scroller.value;
  if (!el || !el.clientWidth) return;
  // The next touch may still be a flick across columns: rows ignore swipes until the columns have rested for a moment
  ui.paging = true;
  clearTimeout(pagingIdle);
  pagingIdle = setTimeout(() => (ui.paging = false), 300);
  holdWithinOneColumn(el);
  const position = el.scrollLeft / el.clientWidth;
  ui.columnProgress = position;
  active.value = Math.round(position);
}

function goTo(index: number) {
  active.value = index;
  const el = scroller.value;
  if (el) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
}

// A different project or view starts at its first tab
watch(
  () => [app.projectId, app.view],
  async () => {
    active.value = 0;
    ui.columnProgress = 0;
    ui.navHidden = false;
    await nextTick();
    scroller.value?.scrollTo({ left: 0 });
  }
);

// Hiding the done or archived columns can leave the tab in view without a column
watch(
  () => app.columns.length,
  (count) => {
    if (active.value >= count) goTo(Math.max(count - 1, 0));
  }
);

// The board must not be rescanned under a dragging finger (see useAutoRefresh)
watch(
  () => drag.busy.value,
  (busy) => (ui.dragging = busy)
);
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
      <ColumnTabs @select="goTo" @step="(delta) => goTo(Math.min(Math.max(active + delta, 0), app.columns.length - 1))" />

      <div
        ref="scroller"
        class="flex min-h-0 flex-1 overflow-x-auto"
        :class="drag.dragging.value ? 'snap-none' : 'snap-x snap-mandatory'"
        data-testid="columns"
        @touchstart.passive="onTouchStart"
        @scroll.passive="onScroll"
      >
        <!-- snap-always: a hard flick stops at the next column instead of flying past several -->
        <section
          v-for="col in app.columns"
          :key="col.key"
          class="h-full w-full shrink-0 snap-center snap-always overflow-y-auto overscroll-y-contain bg-card pb-24"
          :data-column="col.key"
          :data-bucket="col.bucket ?? undefined"
          data-testid="column"
          @scroll.passive="onListScroll"
        >
          <ul>
            <template v-for="task in col.tasks" :key="task.id">
              <li
                v-if="!isDragged(task) && dropIndex(col.key) === shown(col.tasks).indexOf(task)"
                class="h-0.5 bg-accent"
                data-testid="drop-line"
              ></li>
              <li
                :data-task-id="task.id"
                :class="isDragged(task) ? 'pointer-events-none invisible fixed' : ''"
                @pointerdown="drag.onPointerDown($event, task)"
                @contextmenu.prevent
              >
                <TaskRow
                  :task="task"
                  :selected="app.isSelected(task.id)"
                  :lifted="drag.holding.value?.id === task.id"
                  :bulk-count="bulkCount(task)"
                  @tap="onTap(task)"
                  @done="actions.markDone(targets(task))"
                  @reopen="actions.reopen(targets(task))"
                  :left-action="leftAction"
                  @move="onSwipeLeft(task)"
                />
              </li>
            </template>
            <li v-if="dropIndex(col.key) >= shown(col.tasks).length" class="h-0.5 bg-accent" data-testid="drop-line"></li>
          </ul>
          <p v-if="!col.tasks.length" class="pt-10 text-center text-sm text-muted">
            {{ app.isFiltering ? t('board.noMatches') : t('board.emptyBucket') }}
          </p>
        </section>
      </div>

      <!-- The card being dragged, under the finger -->
      <div
        v-if="drag.dragging.value"
        class="pointer-events-none fixed z-30 shadow-2xl transition-transform duration-150"
        :class="'rotate-1 scale-105 opacity-95'"
        :style="{
          left: `${drag.ghost.value.x - drag.ghost.value.offsetX}px`,
          top: `${drag.ghost.value.y - drag.ghost.value.offsetY}px`,
          width: `${drag.ghost.value.width}px`,
        }"
        data-testid="drag-ghost"
      >
        <TaskRow :task="drag.dragging.value" inert />
      </div>

      <BottomNav />
      <!-- The add button, above the navigation bar; while tasks are selected the bulk edits are in the toolbar instead -->
      <BulkToolbar v-if="!drag.dragging.value && app.selectedCount > 0" />
      <button
        v-if="!drag.dragging.value && app.selectedCount === 0"
        class="fixed right-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg shadow-black/25 transition-[bottom] duration-200 active:scale-95"
        :style="{ bottom: app.navVisible ? '5rem' : '1.25rem', marginBottom: 'env(safe-area-inset-bottom)' }"
        :aria-label="t('task.new')"
        data-testid="fab"
        @click="ui.open({ type: 'quickadd' })"
      >
        <Plus class="h-7 w-7" />
      </button>
    </template>
  </div>
</template>
