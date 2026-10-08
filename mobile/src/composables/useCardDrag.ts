import { ref, shallowRef, computed, onMounted, onBeforeUnmount, type Ref } from 'vue';
import type { Task } from '@jotter/vault-format';
import { computeDropTarget, positionForIndex, type ColumnBox, type DropTarget } from './dragMath';

/** How long a press has to last to count as a hold. Mutable so that tests can shorten it. */
export const holdConfig = { ms: 350 };
/** Moving this far before the hold is over means the user is scrolling or swiping. */
const MOVE_TOLERANCE = 10;
/** Moving this far after the hold is over means the user is dragging the row. */
const DRAG_SLOP = 6;

export interface DragDeps {
  /** The element that scrolls sideways between the columns. */
  scroller: Ref<HTMLElement | null>;
  /** Positions of the tasks in a bucket, in order, without the task being moved. */
  siblings: (bucket: string, excludeId: string) => number[];
  move: (taskId: string, bucket: string, position: number) => Promise<void>;
  /** The row was held and let go without moving it. */
  onHoldRelease: (task: Task) => void;
  onError: (err: unknown) => void;
}

/**
 * One long-press, two meanings, told apart by what the finger does next:
 * - held and let go without moving: `onHoldRelease` (the board selects the task);
 * - held and then moved: the row is lifted and dragged up or down to another place in its own list.
 * Moving a task to another column is a swipe and a picker, not a drag. A short press still opens the row and a
 * swipe still acts on it, because nothing happens before the hold.
 */
export function useCardDrag(deps: DragDeps) {
  const dragging = shallowRef<Task | null>(null);
  /** The row whose hold has just fired and that has not been moved yet. */
  const holding = shallowRef<Task | null>(null);
  /** A hold or a drag is going on: the board must not change, and swipes stand down. */
  const busy = computed(() => !!(dragging.value || holding.value));
  const ghost = ref({ x: 0, y: 0, width: 0, offsetX: 0, offsetY: 0 });
  const target = shallowRef<DropTarget | null>(null);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointer = { id: -1, x: 0, y: 0, startX: 0, startY: 0 };
  let pending: { task: Task; el: HTMLElement } | null = null;
  let suppressClickUntil = 0;

  // Once the hold has fired the finger belongs to this code: if it moves, the browser must not turn it into a
  // scroll before the drag has had its first move.
  const blockScroll = (e: TouchEvent) => {
    if ((dragging.value || holding.value) && e.cancelable) e.preventDefault();
  };

  function readColumns(): ColumnBox[] {
    const root = deps.scroller.value;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('[data-column]'))
      .filter((el) => el.dataset.bucket !== undefined && el.dataset.bucket === dragging.value?.bucket)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          key: el.dataset.column!,
          bucket: el.dataset.bucket ?? null,
          left: rect.left,
          right: rect.right,
          cards: Array.from(el.querySelectorAll<HTMLElement>('[data-task-id]'))
            .filter((card) => card.dataset.taskId !== dragging.value?.id)
            .map((card) => {
              const r = card.getBoundingClientRect();
              return { id: card.dataset.taskId!, top: r.top, bottom: r.bottom };
            }),
        };
      });
  }

  function updateTarget() {
    target.value = computeDropTarget(readColumns(), pointer.x, pointer.y);
  }

  /** The hold has lasted long enough. What it means depends on what happens next. */
  function hold() {
    if (!pending) return;
    holding.value = pending.task;
    navigator.vibrate?.(15);
  }

  /** The held row was moved: lift it. */
  function startDrag() {
    if (!pending || !holding.value) return;
    const rect = pending.el.getBoundingClientRect();
    ghost.value = {
      x: pointer.x,
      y: pointer.y,
      width: rect.width,
      offsetX: pointer.startX - rect.left,
      offsetY: pointer.startY - rect.top,
    };
    dragging.value = holding.value;
    holding.value = null;
    updateTarget();
  }

  function cleanup() {
    clearTimeout(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    pending = null;
    dragging.value = null;
    holding.value = null;
    target.value = null;
  }

  function onMove(e: PointerEvent) {
    if (e.pointerId !== pointer.id) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    const moved = Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY);
    if (dragging.value) {
      ghost.value = { ...ghost.value, x: pointer.x, y: pointer.y };
      updateTarget();
    } else if (holding.value) {
      if (moved > DRAG_SLOP) startDrag();
    } else if (moved > MOVE_TOLERANCE) {
      // Moved before the hold finished: the user is scrolling or swiping, not holding
      cleanup();
    }
  }

  async function onUp(e: PointerEvent) {
    if (e.pointerId !== pointer.id) return;
    const task = dragging.value;
    const held = holding.value;
    const drop = target.value;
    cleanup();
    // The tap that ends a hold or a drag must not also open a row
    if (held || task) suppressClickUntil = Date.now() + 400;
    if (held) return deps.onHoldRelease(held);
    if (!task) return;
    if (!drop) return;
    const position = positionForIndex(deps.siblings(drop.bucket, task.id), drop.index);
    if (drop.bucket === task.bucket && position === task.position) return;
    try {
      await deps.move(task.id, drop.bucket, position);
    } catch (err) {
      deps.onError(err);
    }
  }

  function onCancel(e: PointerEvent) {
    if (e.pointerId === pointer.id) cleanup();
  }

  function onPointerDown(e: PointerEvent, task: Task) {
    if (busy.value || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cleanup();
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    pending = { task, el: e.currentTarget as HTMLElement };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    timer = setTimeout(hold, holdConfig.ms);
  }

  /** True right after a hold or a drag ended, so the tap that ends the gesture does not also open the row. */
  const consumeClick = () => Date.now() < suppressClickUntil;

  // The listener has to exist before the finger lands: the browser decides at touch start whether it must wait
  // for the page before scrolling, so one added when the drag begins would come too late and the gesture would
  // be turned into a scroll. It only cancels the scroll while a card is being dragged.
  onMounted(() => document.addEventListener('touchmove', blockScroll, { passive: false }));
  onBeforeUnmount(() => {
    document.removeEventListener('touchmove', blockScroll);
    cleanup();
  });

  return { dragging, holding, busy, ghost, target, onPointerDown, consumeClick };
}
