import { ref, onBeforeUnmount } from 'vue';

/**
 * Touch long-press detection. Bind the four handlers to an element; `onLongPress` fires after `delay` ms
 * unless the finger moves more than 10px. After a long press, the click that follows should be ignored
 * (check `isLongPressTriggered`).
 */
export function useLongPress(onLongPress: () => void, delay = 450) {
  const isLongPressTriggered = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isLongPressTriggered.value = false;

    timer = setTimeout(() => {
      isLongPressTriggered.value = true;
      onLongPress();
    }, delay);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!timer) return;
    if (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) {
      clearTimer();
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    clearTimer();
    if (isLongPressTriggered.value) {
      // Swallow the click that follows a long press, then re-arm
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        isLongPressTriggered.value = false;
      }, 150);
    }
  };

  const onTouchCancel = () => {
    clearTimer();
    isLongPressTriggered.value = false;
  };

  onBeforeUnmount(clearTimer);

  return { isLongPressTriggered, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
