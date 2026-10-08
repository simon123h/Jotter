import { ref, shallowRef, onMounted, onBeforeUnmount, type Ref } from 'vue';
import type { Task } from '@jotter/vault-format';
import { computeDropTarget, positionForIndex, type ColumnBox, type DropTarget } from './dragMath';

const HOLD_MS = 350;
const MOVE_TOLERANCE = 10;

export interface DragDeps {
  /** The element that scrolls sideways between the columns. */
  scroller: Ref<HTMLElement | null>;
  /** Positions of the tasks in a bucket, in order, without the task being moved. */
  siblings: (bucket: string, excludeId: string) => number[];
  move: (taskId: string, bucket: string, position: number) => Promise<void>;
  onError: (err: unknown) => void;
}

/**
 * Long-press a row, then drag it up or down to put it somewhere else in its own list. Moving a task to another
 * column is a swipe and a picker, not a drag. A short press still opens the row and a swipe still acts on it,
 * because the drag only starts after the hold.
 */
export function useCardDrag(deps: DragDeps) {
  const dragging = shallowRef<Task | null>(null);
  const ghost = ref({ x: 0, y: 0, width: 0, offsetX: 0, offsetY: 0 });
  const target = shallowRef<DropTarget | null>(null);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointer = { id: -1, x: 0, y: 0, startX: 0, startY: 0 };
  let pending: { task: Task; el: HTMLElement } | null = null;
  let suppressClickUntil = 0;

  const blockScroll = (e: TouchEvent) => {
    if (dragging.value && e.cancelable) e.preventDefault();
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

  function begin() {
    if (!pending) return;
    const rect = pending.el.getBoundingClientRect();
    ghost.value = {
      x: pointer.x,
      y: pointer.y,
      width: rect.width,
      offsetX: pointer.x - rect.left,
      offsetY: pointer.y - rect.top,
    };
    dragging.value = pending.task;
    navigator.vibrate?.(15);
    updateTarget();
  }

  function cleanup() {
    clearTimeout(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    pending = null;
    dragging.value = null;
    target.value = null;
  }

  function onMove(e: PointerEvent) {
    if (e.pointerId !== pointer.id) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!dragging.value) {
      // Moved before the hold finished: the user is scrolling, not dragging
      if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > MOVE_TOLERANCE) cleanup();
      return;
    }
    ghost.value = { ...ghost.value, x: pointer.x, y: pointer.y };
    updateTarget();
  }

  async function onUp(e: PointerEvent) {
    if (e.pointerId !== pointer.id) return;
    const task = dragging.value;
    const drop = target.value;
    cleanup();
    if (!task) return;
    suppressClickUntil = Date.now() + 400;
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
    if (dragging.value || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cleanup();
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    pending = { task, el: e.currentTarget as HTMLElement };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    timer = setTimeout(begin, HOLD_MS);
  }

  /** True right after a drag ended, so the tap that ends the gesture does not also open the card. */
  const consumeClick = () => Date.now() < suppressClickUntil;

  // The listener has to exist before the finger lands: the browser decides at touch start whether it must wait
  // for the page before scrolling, so one added when the drag begins would come too late and the gesture would
  // be turned into a scroll. It only cancels the scroll while a card is being dragged.
  onMounted(() => document.addEventListener('touchmove', blockScroll, { passive: false }));
  onBeforeUnmount(() => {
    document.removeEventListener('touchmove', blockScroll);
    cleanup();
  });

  return { dragging, ghost, target, onPointerDown, consumeClick };
}
