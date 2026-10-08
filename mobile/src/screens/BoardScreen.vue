<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Plus, TriangleAlert } from '@lucide/vue';
import AppBar from '@/components/AppBar.vue';
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

/** The buckets a card can be dropped on; the column of unknown buckets is not one of them. */
const dockColumns = computed(() => app.columns.filter((c) => c.bucket !== null));

const drag = useCardDrag({
  scroller,
  siblings: (bucket, excludeId) => app.positionsIn(bucket, excludeId),
  move: async (id, bucket, position) => {
    const before = app.taskById(id);
    await app.moveTask(id, bucket, position);
    if (before) actions.announceMove(id, { bucket: before.bucket, position: before.position }, bucket);
  },
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

// The board must not be rescanned under a dragging finger (see useAutoRefresh)
watch(
  () => !!drag.dragging.value,
  (dragging) => (ui.dragging = dragging)
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
                  @open="openTask(task.id)"
                  @done="actions.markDone(task.id)"
                  @archive="actions.archive(task.id)"
                  @reopen="actions.reopen(task.id)"
                  @move="ui.open({ type: 'move', id: task.id })"
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
        :class="drag.target.value?.dock ? '-translate-y-[130%] scale-90 opacity-80' : 'rotate-1 scale-105 opacity-95'"
        :style="{
          left: `${drag.ghost.value.x - drag.ghost.value.offsetX}px`,
          top: `${drag.ghost.value.y - drag.ghost.value.offsetY}px`,
          width: `${drag.ghost.value.width}px`,
        }"
        data-testid="drag-ghost"
      >
        <TaskRow :task="drag.dragging.value" inert />
      </div>

      <!-- While a card is dragged: a chip per bucket in the thumb zone. Slide onto one and let go to move the card. -->
      <Transition name="dock">
        <div
          v-if="drag.dragging.value && dockColumns.length > 1"
          class="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 shadow-2xl backdrop-blur"
          style="padding-bottom: env(safe-area-inset-bottom)"
          data-testid="drop-dock"
        >
          <div class="px-4 pt-2 text-xs font-medium text-muted">{{ t('board.moveTo') }}</div>
          <div class="grid gap-1.5 p-3 pt-2" :style="{ gridTemplateColumns: `repeat(${Math.min(dockColumns.length, 5)}, minmax(0, 1fr))` }">
            <div
              v-for="col in dockColumns"
              :key="col.key"
              class="flex h-14 flex-col items-center justify-center rounded-xl border px-1 text-center text-xs font-medium leading-tight transition-colors"
              :class="
                drag.target.value?.dock && drag.target.value.bucket === col.bucket
                  ? 'border-accent bg-accent text-accent-ink'
                  : col.bucket === drag.dragging.value.bucket
                    ? 'border-line bg-surface text-muted opacity-50'
                    : 'border-line bg-surface'
              "
              :data-dock-bucket="col.bucket"
              data-testid="dock-chip"
            >
              <span class="line-clamp-2 max-w-full break-words">{{ col.title }}</span>
              <span class="opacity-70">{{ col.tasks.length }}</span>
            </div>
          </div>
        </div>
      </Transition>

      <button
        v-if="!drag.dragging.value"
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
