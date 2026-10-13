<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const emit = defineEmits<{ (e: 'select', index: number): void; (e: 'step', delta: -1 | 1): void }>();

const app = useAppStore();
const ui = useUiStore();

const strip = ref<HTMLElement | null>(null);
const tabs = ref<HTMLElement[]>([]);
/** Where each tab sits in the strip, measured after rendering. */
const boxes = ref<{ left: number; width: number }[]>([]);

const title = (key: string, text: string) => (key === '__other' ? t('board.other') : text);

// Vue calls this with null when a tab goes away: keep only tabs that exist
function setTab(index: number, el: HTMLElement | null) {
  if (el) {
    tabs.value[index] = el;
    sizes?.observe(el);
  } else {
    if (tabs.value[index]) sizes?.unobserve(tabs.value[index]);
    delete tabs.value[index];
  }
}

// A tab changes its width with the system's font size or zoom, without any title or count changing
const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());

function measure() {
  boxes.value = app.columns.flatMap((_, i) =>
    tabs.value[i] ? [{ left: tabs.value[i].offsetLeft, width: tabs.value[i].offsetWidth }] : []
  );
}

/** Where the columns are between two neighbouring tabs: the tab before, the tab after and how far (0 to 1) between them. */
const between = computed(() => {
  const count = boxes.value.length;
  const progress = Math.min(Math.max(ui.columnProgress, 0), Math.max(count - 1, 0));
  const from = Math.floor(progress);
  return { count, from, to: Math.min(from + 1, count - 1), f: progress - from };
});

/** The indicator slides between two tabs while the columns are being swiped, instead of jumping at the end. */
const indicator = computed(() => {
  const { count, from, to, f } = between.value;
  if (!count) return { left: 0, width: 0 };
  const a = boxes.value[from];
  const b = boxes.value[to];
  return { left: a.left + (b.left - a.left) * f, width: a.width + (b.width - a.width) * f };
});

/** How much a tab is the one in view, 1 when the columns rest on it and 0 from one column away: its colour blends. */
const weight = (index: number) => Math.max(0, 1 - Math.abs(ui.columnProgress - index));
const colour = (index: number) => `color-mix(in srgb, var(--color-accent) ${Math.round(weight(index) * 100)}%, var(--color-muted))`;

/**
 * The strip moves with the columns, frame by frame, so that the tab in view stays centred without an animation of
 * its own that would run behind the finger. A strip the user scrolled by hand stays put until the columns move again.
 */
function follow() {
  const box = strip.value;
  const { count, from, to, f } = between.value;
  if (!box || !count) return;
  const middle = (i: number) => boxes.value[i].left + boxes.value[i].width / 2;
  const target = middle(from) + (middle(to) - middle(from)) * f - box.clientWidth / 2;
  box.scrollLeft = Math.min(Math.max(target, 0), Math.max(box.scrollWidth - box.clientWidth, 0));
}
watch([() => ui.columnProgress, boxes], follow, { flush: 'post' });

// Titles and counts change the tab widths
watch(
  () => app.columns.map((c) => `${c.key}:${c.title}:${c.tasks.length}`).join('|'),
  async () => {
    await nextTick();
    measure();
  },
  { flush: 'post' }
);

// A sideways swipe on the strip steps to the previous or next column. Rows own horizontal swipes (they act on
// the task), so this is the place to page with a finger; the strip itself follows the selected tab.
let swipe: { x: number; y: number } | null = null;
const onDown = (e: PointerEvent) => (swipe = { x: e.clientX, y: e.clientY });
const onUp = (e: PointerEvent) => {
  const from = swipe;
  swipe = null;
  if (!from) return;
  const dx = e.clientX - from.x;
  if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(e.clientY - from.y) * 1.5) emit('step', dx < 0 ? 1 : -1);
};

onMounted(() => {
  measure();
  window.addEventListener('resize', measure);
  if (strip.value) sizes?.observe(strip.value);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  sizes?.disconnect();
});
</script>

<template>
  <div class="relative shrink-0 border-b border-line bg-card" data-testid="column-tabs">
    <nav
      ref="strip"
      class="relative flex touch-pan-y overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Buckets"
      data-testid="tab-strip"
      @pointerdown="onDown"
      @pointerup="onUp"
      @pointercancel="swipe = null"
    >
      <button
        v-for="(col, i) in app.columns"
        :key="col.key"
        :ref="(el) => setTab(i, el as HTMLElement | null)"
        role="tab"
        :aria-selected="i === ui.activeColumn"
        class="flex h-12 min-w-[5.5rem] flex-[1_0_auto] items-center justify-center gap-1.5 whitespace-nowrap px-4 text-sm font-medium active:bg-line/60"
        :style="{ color: colour(i) }"
        data-testid="bucket-tab"
        @click="emit('select', i)"
      >
        {{ title(col.key, col.title) }}
        <span class="text-xs opacity-70">{{ col.tasks.length }}</span>
      </button>
      <span
        class="pointer-events-none absolute bottom-0 h-[3px] rounded-t-full bg-accent"
        :style="{ left: `${indicator.left}px`, width: `${indicator.width}px` }"
        data-testid="tab-indicator"
      ></span>
    </nav>
  </div>
</template>
