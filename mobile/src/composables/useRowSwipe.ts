import { ref, onBeforeUnmount } from 'vue';

/** How far a row has to be pulled before letting go triggers its action. */
export const SWIPE_TRIGGER = 96;
const MAX_PULL = 160;
const INTENT_SLOP = 8;
const FLING_SPEED = 0.6; // px per ms
const FLING_MIN = 40;

export type SwipeDirection = 'right' | 'left';

export interface RowSwipeOptions {
  /** Which directions do something for this row. A direction without an action resists the finger. */
  allowed: (direction: SwipeDirection) => boolean;
  /** Called once the row is let go past the trigger. */
  onTrigger: (direction: SwipeDirection) => void;
  /** Whether the row slides out of the way (an action that removes it) or springs back (a picker opens). */
  exits: (direction: SwipeDirection) => boolean;
  disabled: () => boolean;
}

/**
 * Slide a row sideways to act on it, as in Todoist. A mostly horizontal move picks the swipe, a mostly vertical one
 * is left to scrolling. The row must have `touch-action: pan-y`, so that the browser keeps horizontal moves for
 * this code instead of scrolling the columns sideways.
 */
export function useRowSwipe(options: RowSwipeOptions) {
  /** How far the row is shifted: positive to the right. */
  const dx = ref(0);
  /** Animate the shift (when it springs back or leaves), but not while the finger drags it. */
  const settling = ref(false);
  /** Past the trigger point right now: the action will fire on release. */
  const armed = ref(false);

  let start = { id: -1, x: 0, y: 0 };
  let intent: 'undecided' | 'swipe' | 'scroll' = 'undecided';
  let last = { x: 0, t: 0, speed: 0 };
  let suppressClickUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const rubber = (pull: number) => (Math.abs(pull) <= MAX_PULL ? pull : Math.sign(pull) * (MAX_PULL + (Math.abs(pull) - MAX_PULL) * 0.2));

  function stop() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  function onMove(e: PointerEvent) {
    if (e.pointerId !== start.id) return;
    // A hold fired on this row (it is being selected or dragged): the finger is not swiping any more
    if (options.disabled()) {
      if (intent === 'swipe') {
        settling.value = true;
        dx.value = 0;
      }
      return finish();
    }
    const moveX = e.clientX - start.x;
    const moveY = e.clientY - start.y;

    if (intent === 'undecided') {
      if (Math.abs(moveX) > INTENT_SLOP && Math.abs(moveX) > Math.abs(moveY) * 1.2) intent = 'swipe';
      else if (Math.abs(moveY) > INTENT_SLOP) intent = 'scroll';
      if (intent === 'scroll') return stop();
      if (intent === 'undecided') return;
    }

    const now = e.timeStamp || Date.now();
    if (now > last.t) last.speed = (e.clientX - last.x) / (now - last.t);
    last = { x: e.clientX, t: now, speed: last.speed };

    const direction: SwipeDirection = moveX > 0 ? 'right' : 'left';
    // A row with nothing to do in that direction only gives a little, so it feels closed
    dx.value = options.allowed(direction) ? rubber(moveX) : moveX * 0.15;
    const nowArmed = options.allowed(direction) && Math.abs(dx.value) >= SWIPE_TRIGGER;
    if (nowArmed && !armed.value) navigator.vibrate?.(10);
    armed.value = nowArmed;
  }

  function finish() {
    stop();
    armed.value = false;
    intent = 'undecided';
  }

  function onUp(e: PointerEvent) {
    if (e.pointerId !== start.id) return;
    const swiped = intent === 'swipe';
    const pulled = dx.value;
    const speed = last.speed;
    finish();
    if (!swiped) return;

    // The tap that ends a swipe must not open the task
    suppressClickUntil = Date.now() + 400;
    const direction: SwipeDirection = pulled > 0 ? 'right' : 'left';
    const flung = Math.abs(speed) >= FLING_SPEED && Math.abs(pulled) >= FLING_MIN && Math.sign(speed) === Math.sign(pulled);
    const triggered = options.allowed(direction) && (Math.abs(pulled) >= SWIPE_TRIGGER || flung);

    settling.value = true;
    if (!triggered) {
      dx.value = 0;
      return;
    }
    if (options.exits(direction)) {
      // Slide out of the way first, then act: the row disappears from the list on its own
      dx.value = (direction === 'right' ? 1 : -1) * window.innerWidth;
      timer = setTimeout(() => options.onTrigger(direction), 160);
    } else {
      dx.value = 0;
      options.onTrigger(direction);
    }
  }

  function onCancel(e: PointerEvent) {
    if (e.pointerId !== start.id) return;
    const wasSwiping = intent === 'swipe';
    finish();
    if (wasSwiping) {
      settling.value = true;
      dx.value = 0;
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (options.disabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    clearTimeout(timer);
    stop();
    settling.value = false;
    dx.value = 0;
    intent = 'undecided';
    start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    last = { x: e.clientX, t: e.timeStamp || Date.now(), speed: 0 };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  /** True right after a swipe, so that its closing tap is not taken for a click. */
  const consumeClick = () => Date.now() < suppressClickUntil;

  onBeforeUnmount(() => {
    clearTimeout(timer);
    stop();
  });

  return { dx, settling, armed, onPointerDown, consumeClick };
}
