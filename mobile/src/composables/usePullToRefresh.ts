import { ref, watch, onBeforeUnmount, type Ref } from 'vue';

const THRESHOLD = 64;
const MAX_PULL = 96;
const DEAD_ZONE = 12;

/**
 * Pull a column down from its top to refresh. Only a mostly vertical pull that starts with the column scrolled
 * to the top counts, so scrolling, swiping between columns and long-press dragging are left alone.
 */
export function usePullToRefresh(root: Ref<HTMLElement | null>, opts: { onRefresh: () => Promise<void>; disabled: () => boolean }) {
  /** How far the content is pulled down, in px. */
  const pull = ref(0);
  const refreshing = ref(false);

  let column: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let active = false;

  function onStart(e: TouchEvent) {
    column = (e.target as HTMLElement).closest<HTMLElement>('[data-column]');
    active = !!column && column.scrollTop <= 0 && !refreshing.value && !opts.disabled() && e.touches.length === 1;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }

  function onMove(e: TouchEvent) {
    if (!active || opts.disabled()) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (dy <= DEAD_ZONE || Math.abs(dx) > dy) {
      if (dy <= 0) pull.value = 0;
      return;
    }
    // Resistance: the content follows the finger at half speed
    pull.value = Math.min(MAX_PULL, (dy - DEAD_ZONE) * 0.5);
  }

  async function onEnd() {
    const release = pull.value;
    active = false;
    column = null;
    if (release >= THRESHOLD * 0.5 && !refreshing.value && release > 0) {
      // Hold the indicator at its resting height while the scan runs
      refreshing.value = true;
      pull.value = THRESHOLD * 0.6;
      try {
        await opts.onRefresh();
      } finally {
        refreshing.value = false;
        pull.value = 0;
      }
    } else {
      pull.value = 0;
    }
  }

  function attach(el: HTMLElement) {
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
  }

  function detach(el: HTMLElement) {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onEnd);
  }

  // The scroller only exists once there is a project, so follow the element instead of attaching once
  watch(
    root,
    (el, previous) => {
      if (previous) detach(previous);
      if (el) attach(el);
    },
    { immediate: true, flush: 'post' }
  );
  onBeforeUnmount(() => {
    if (root.value) detach(root.value);
  });

  return { pull, refreshing };
}
