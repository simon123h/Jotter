import { ref, type Ref } from 'vue';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { useModalStore } from '@/stores/modal';
import type { Timeblock } from '@/types';
import { HOUR_HEIGHT, SNAP_MINUTES, timeToMinutes, minutesToTime } from '../utils/timeGrid';

interface Ghost {
  id: string;
  start_time: string;
  end_time: string;
}

interface DragOptions {
  startY: number;
  /** Pixels of movement before the gesture counts as a drag rather than a click. */
  threshold: number;
  cursor: string;
  onStart: () => void;
  onDrag: (deltaY: number) => void;
  /** Called on mouseup, after listeners are removed, with whether the threshold was crossed. */
  onEnd: (moved: boolean) => Promise<void> | void;
}

function trackVerticalDrag({ startY, threshold, cursor, onStart, onDrag, onEnd }: DragOptions) {
  let moved = false;

  const onMouseMove = (e: MouseEvent) => {
    const deltaY = e.clientY - startY;
    if (!moved && Math.abs(deltaY) > threshold) {
      moved = true;
      onStart();
      document.body.style.userSelect = 'none';
      document.body.style.cursor = cursor;
    }
    if (moved) onDrag(deltaY);
  };

  const onMouseUp = async () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    await onEnd(moved);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

/** Drag-to-move and drag-to-resize for timeblock boxes, snapped to 15 minutes. */
export function useTimeblockDrag(startHour: Ref<number>, endHour: Ref<number>) {
  const timeblockStore = useTimeblockStore();
  const modalStore = useModalStore();

  const movingTimeblockId = ref<string | null>(null);
  const movingGhost = ref<Ghost | null>(null);
  const resizingTimeblockId = ref<string | null>(null);
  const resizingGhost = ref<Ghost | null>(null);

  const startMove = (event: MouseEvent, tb: Timeblock) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, .task-item-card, .timeblock-resize-handle, input, a')) return;

    const origStartMin = timeToMinutes(tb.start_time);
    const durationMin = timeToMinutes(tb.end_time) - origStartMin;

    trackVerticalDrag({
      startY: event.clientY,
      threshold: 4,
      cursor: 'move',
      onStart: () => {
        movingTimeblockId.value = tb.id;
      },
      onDrag: (deltaY) => {
        const rawStartMinutes = origStartMin + (deltaY / HOUR_HEIGHT) * 60;
        const snappedStartMin = Math.round(rawStartMinutes / SNAP_MINUTES) * SNAP_MINUTES;

        const minAllowed = startHour.value * 60;
        const maxAllowed = (endHour.value + 1) * 60 - durationMin;
        const clampedStartMin = Math.max(minAllowed, Math.min(maxAllowed, snappedStartMin));

        movingGhost.value = {
          id: tb.id,
          start_time: minutesToTime(clampedStartMin),
          end_time: minutesToTime(clampedStartMin + durationMin),
        };
      },
      onEnd: async (moved) => {
        try {
          if (moved && movingGhost.value) {
            const { start_time, end_time } = movingGhost.value;
            if (start_time !== tb.start_time || end_time !== tb.end_time) {
              await timeblockStore.updateTimeblock(tb.id, { start_time, end_time });
            }
          } else if (!moved) {
            // A click without movement opens the editor
            modalStore.openTimeblockEdit(tb);
          }
        } finally {
          movingTimeblockId.value = null;
          movingGhost.value = null;
        }
      },
    });
  };

  const startResize = (event: MouseEvent, tb: Timeblock) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const origStartMin = timeToMinutes(tb.start_time);
    const origDuration = timeToMinutes(tb.end_time) - origStartMin;

    trackVerticalDrag({
      startY: event.clientY,
      threshold: 3,
      cursor: 'ns-resize',
      onStart: () => {
        resizingTimeblockId.value = tb.id;
      },
      onDrag: (deltaY) => {
        const rawDuration = origDuration + (deltaY / HOUR_HEIGHT) * 60;
        const snappedDuration = Math.max(15, Math.round(rawDuration / SNAP_MINUTES) * SNAP_MINUTES);

        const maxMinutes = (endHour.value + 1) * 60;
        const clampedDuration = Math.min(maxMinutes - origStartMin, snappedDuration);

        resizingGhost.value = {
          id: tb.id,
          start_time: tb.start_time,
          end_time: minutesToTime(origStartMin + clampedDuration),
        };
      },
      onEnd: async (moved) => {
        try {
          if (moved && resizingGhost.value && resizingGhost.value.end_time !== tb.end_time) {
            await timeblockStore.updateTimeblock(tb.id, { end_time: resizingGhost.value.end_time });
          }
        } finally {
          resizingTimeblockId.value = null;
          resizingGhost.value = null;
        }
      },
    });
  };

  /** The timeblock as it should be drawn right now, including an in-progress drag. */
  const getEffectiveTimeblock = (tb: Timeblock): Timeblock => {
    if (movingGhost.value?.id === tb.id) {
      return { ...tb, start_time: movingGhost.value.start_time, end_time: movingGhost.value.end_time };
    }
    if (resizingGhost.value?.id === tb.id) {
      return { ...tb, end_time: resizingGhost.value.end_time };
    }
    return tb;
  };

  return { movingTimeblockId, resizingTimeblockId, startMove, startResize, getEffectiveTimeblock };
}
