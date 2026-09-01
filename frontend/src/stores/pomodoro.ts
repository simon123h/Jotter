import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { playPomodoroChime } from '@/utils/sound';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

const SETTINGS_KEY = 'jotter_pomodoro_settings';

export const usePomodoroStore = defineStore('pomodoro', () => {
  // Settings
  const work_duration = ref<number>(25); // in minutes
  const short_break_duration = ref<number>(5);
  const long_break_duration = ref<number>(15);
  const long_break_interval = ref<number>(4);
  const sound_enabled = ref<boolean>(true);

  // Load saved settings
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.work_duration) work_duration.value = parsed.work_duration;
      if (parsed.short_break_duration) short_break_duration.value = parsed.short_break_duration;
      if (parsed.long_break_duration) long_break_duration.value = parsed.long_break_duration;
      if (parsed.long_break_interval) long_break_interval.value = parsed.long_break_interval;
      if (typeof parsed.sound_enabled === 'boolean') sound_enabled.value = parsed.sound_enabled;
    }
  } catch {
    // Ignore localStorage errors
  }

  const saveSettings = () => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          work_duration: work_duration.value,
          short_break_duration: short_break_duration.value,
          long_break_duration: long_break_duration.value,
          long_break_interval: long_break_interval.value,
          sound_enabled: sound_enabled.value,
        })
      );
    } catch {
      // Ignore
    }
  };

  // Runtime State
  const phase = ref<PomodoroPhase>('work');
  const status = ref<PomodoroStatus>('idle');
  const time_remaining = ref<number>(work_duration.value * 60);
  const completed_cycles = ref<number>(0);
  const is_bar_open = ref<boolean>(false);

  // Attached Task (optional focus context)
  const active_task_id = ref<string | null>(null);
  const active_task_title = ref<string | null>(null);

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  const originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'Jotter';

  const current_duration_seconds = computed(() => {
    switch (phase.value) {
      case 'short_break':
        return short_break_duration.value * 60;
      case 'long_break':
        return long_break_duration.value * 60;
      case 'work':
      default:
        return work_duration.value * 60;
    }
  });

  const formatted_time = computed(() => {
    const totalSec = Math.max(0, time_remaining.value);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  const progress_percent = computed(() => {
    const total = current_duration_seconds.value;
    if (total <= 0) return 0;
    const elapsed = total - time_remaining.value;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  });

  const updateDocumentTitle = () => {
    if (typeof document === 'undefined') return;
    if (status.value === 'running') {
      const emoji = phase.value === 'work' ? '🍅' : '☕';
      document.title = `(${formatted_time.value}) ${emoji} Jotter`;
    } else {
      document.title = originalDocumentTitle;
    }
  };

  watch([formatted_time, status, phase], () => {
    updateDocumentTitle();
  });

  const triggerPhaseEnd = () => {
    pause();
    if (sound_enabled.value) {
      playPomodoroChime();
    }

    if (phase.value === 'work') {
      completed_cycles.value += 1;
      if (completed_cycles.value % long_break_interval.value === 0) {
        switchPhase('long_break');
      } else {
        switchPhase('short_break');
      }
    } else {
      switchPhase('work');
    }
  };

  const tick = () => {
    if (time_remaining.value > 1) {
      time_remaining.value -= 1;
    } else {
      time_remaining.value = 0;
      triggerPhaseEnd();
    }
  };

  const start = () => {
    if (status.value === 'running') return;
    if (time_remaining.value <= 0) {
      time_remaining.value = current_duration_seconds.value;
    }
    status.value = 'running';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    updateDocumentTitle();
  };

  const pause = () => {
    if (status.value !== 'running') return;
    status.value = 'paused';
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    updateDocumentTitle();
  };

  const toggle = () => {
    if (status.value === 'running') {
      pause();
    } else {
      start();
    }
  };

  const reset = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    status.value = 'idle';
    time_remaining.value = current_duration_seconds.value;
    updateDocumentTitle();
  };

  const switchPhase = (newPhase: PomodoroPhase) => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    phase.value = newPhase;
    status.value = 'idle';
    time_remaining.value = current_duration_seconds.value;
    updateDocumentTitle();
  };

  const skip = () => {
    if (phase.value === 'work') {
      completed_cycles.value += 1;
      if (completed_cycles.value % long_break_interval.value === 0) {
        switchPhase('long_break');
      } else {
        switchPhase('short_break');
      }
    } else {
      switchPhase('work');
    }
  };

  const setDurations = (config: { work?: number; short_break?: number; long_break?: number; sound_enabled?: boolean }) => {
    if (config.work && config.work > 0) work_duration.value = config.work;
    if (config.short_break && config.short_break > 0) short_break_duration.value = config.short_break;
    if (config.long_break && config.long_break > 0) long_break_duration.value = config.long_break;
    if (typeof config.sound_enabled === 'boolean') sound_enabled.value = config.sound_enabled;

    saveSettings();

    if (status.value === 'idle') {
      time_remaining.value = current_duration_seconds.value;
    }
  };

  const openBar = () => {
    is_bar_open.value = true;
  };

  const closeBar = () => {
    is_bar_open.value = false;
  };

  const toggleBar = () => {
    is_bar_open.value = !is_bar_open.value;
  };

  const attachTask = (taskId: string, title: string) => {
    active_task_id.value = taskId;
    active_task_title.value = title;
    openBar();
  };

  const detachTask = () => {
    active_task_id.value = null;
    active_task_title.value = null;
  };

  return {
    // State
    phase,
    status,
    time_remaining,
    work_duration,
    short_break_duration,
    long_break_duration,
    long_break_interval,
    completed_cycles,
    is_bar_open,
    sound_enabled,
    active_task_id,
    active_task_title,

    // Getters
    current_duration_seconds,
    formatted_time,
    progress_percent,

    // Actions
    start,
    pause,
    toggle,
    reset,
    skip,
    switchPhase,
    setDurations,
    openBar,
    closeBar,
    toggleBar,
    attachTask,
    detachTask,
  };
});
