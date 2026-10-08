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
  if (el) tabs.value[index] = el;
  else delete tabs.value[index];
}

function measure() {
  boxes.value = app.columns.flatMap((_, i) =>
    tabs.value[i] ? [{ left: tabs.value[i].offsetLeft, width: tabs.value[i].offsetWidth }] : []
  );
}

/** The indicator slides between two tabs while the columns are being swiped, instead of jumping at the end. */
const indicator = computed(() => {
  const count = boxes.value.length;
  if (!count) return { left: 0, width: 0 };
  const progress = Math.min(Math.max(ui.columnProgress, 0), count - 1);
  const from = Math.floor(progress);
  const to = Math.min(from + 1, count - 1);
  const f = progress - from;
  return {
    left: boxes.value[from].left + (boxes.value[to].left - boxes.value[from].left) * f,
    width: boxes.value[from].width + (boxes.value[to].width - boxes.value[from].width) * f,
  };
});

// Keep the selected tab in view when there are more tabs than fit
watch(
  () => ui.activeColumn,
  (index) => {
    const el = tabs.value[index];
    const box = strip.value;
    if (!el || !box) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }
);

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
});
onBeforeUnmount(() => window.removeEventListener('resize', measure));
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
        class="flex h-12 min-w-[5.5rem] flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 text-sm font-medium transition-colors active:bg-line/60"
        :class="i === ui.activeColumn ? 'text-accent' : 'text-muted'"
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
