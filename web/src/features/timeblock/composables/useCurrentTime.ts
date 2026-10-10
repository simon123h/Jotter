import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';
import { getNowIndicatorTop } from '../utils/timeGrid';

/** Minute-resolution clock plus the vertical position of the "now" line on the grid. */
export function useCurrentTime(startHour: Ref<number>, endHour: Ref<number>) {
  const currentTime = ref(new Date());
  let timer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    timer = setInterval(() => {
      currentTime.value = new Date();
    }, 60000);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  const currentTimeStr = computed(() => {
    const h = String(currentTime.value.getHours()).padStart(2, '0');
    const m = String(currentTime.value.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });

  const nowIndicatorTop = computed(() => getNowIndicatorTop(currentTime.value, startHour.value, endHour.value));
  const nowIndicatorStyle = computed(() => (nowIndicatorTop.value === null ? null : { top: `${nowIndicatorTop.value}px` }));

  return { currentTimeStr, nowIndicatorTop, nowIndicatorStyle };
}
