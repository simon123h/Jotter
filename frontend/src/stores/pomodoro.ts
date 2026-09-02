import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { playPomodoroChime } from '@/utils/sound';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

const SETTINGS_KEY = 'jotter_pomodoro_settings';
const STATE_KEY = 'jotter_pomodoro_state';

export const usePomodoroStore = defineStore('pomodoro', () => {
  // Settings
  const work_duration = ref<number>(25); // in minutes
  const short_break_duration = ref<number>(5);
  const long_break_duration = ref<number>(15);
  const long_break_interval = ref<number>(4);
  const sound_enabled = ref<boolean>(true);

  // Runtime State
  const phase = ref<PomodoroPhase>('work');
  const status = ref<PomodoroStatus>('idle');
  const time_remaining = ref<number>(work_duration.value * 60);
  const completed_cycles = ref<number>(0);
  const is_bar_open = ref<boolean>(false);
  const target_end_timestamp = ref<number | null>(null);

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  const originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'Jotter';

  // Load saved settings
  try {
    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed.work_duration) work_duration.value = Math.max(1, Number(parsed.work_duration) || 25);
      if (parsed.short_break_duration) short_break_duration.value = Math.max(1, Number(parsed.short_break_duration) || 5);
      if (parsed.long_break_duration) long_break_duration.value = Math.max(1, Number(parsed.long_break_duration) || 15);
      if (parsed.long_break_interval)
        long_break_interval.value = Math.max(1, Math.min(12, Math.floor(Number(parsed.long_break_interval)) || 4));
      if (typeof parsed.sound_enabled === 'boolean') sound_enabled.value = parsed.sound_enabled;
    }
  } catch {
    // Ignore localStorage errors
  }

  // Compute duration helpers
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

  // Cycle progress getters
  const current_cycle_index = computed(() => {
    return completed_cycles.value % long_break_interval.value;
  });

  const is_next_break_long = computed(() => {
    if (phase.value === 'work') {
      return (completed_cycles.value + 1) % long_break_interval.value === 0;
    }
    return phase.value === 'long_break';
  });

  // Load saved runtime state (with timestamp calculation)
  try {
    const rawState = localStorage.getItem(STATE_KEY);
    if (rawState) {
      const parsed = JSON.parse(rawState);
      if (parsed.phase) phase.value = parsed.phase;
      if (typeof parsed.completed_cycles === 'number') completed_cycles.value = parsed.completed_cycles;
      if (typeof parsed.is_bar_open === 'boolean') is_bar_open.value = parsed.is_bar_open;

      if (parsed.status === 'running' && parsed.target_end_timestamp) {
        const remaining = Math.round((parsed.target_end_timestamp - Date.now()) / 1000);
        if (remaining > 0) {
          time_remaining.value = remaining;
          target_end_timestamp.value = parsed.target_end_timestamp;
          status.value = 'running';
        } else {
          time_remaining.value = 0;
          target_end_timestamp.value = null;
          status.value = 'idle';
        }
      } else if (parsed.status === 'paused' && typeof parsed.time_remaining === 'number') {
        time_remaining.value = parsed.time_remaining;
        status.value = 'paused';
      } else {
        time_remaining.value = current_duration_seconds.value;
      }
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

  const saveState = () => {
    try {
      localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          phase: phase.value,
          status: status.value,
          time_remaining: time_remaining.value,
          completed_cycles: completed_cycles.value,
          is_bar_open: is_bar_open.value,
          target_end_timestamp: target_end_timestamp.value,
        })
      );
    } catch {
      // Ignore
    }
  };

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

  // Automatically synchronize settings changes to localStorage
  watch(
    [work_duration, short_break_duration, long_break_duration, long_break_interval, sound_enabled],
    () => {
      saveSettings();
    },
    { deep: true }
  );

  // Automatically synchronize core state changes to localStorage
  watch(
    [phase, status, completed_cycles, is_bar_open, target_end_timestamp],
    () => {
      saveState();
    },
    { deep: true }
  );

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
      if (phase.value === 'long_break') {
        // Reset cycle round on long break completion
        completed_cycles.value = 0;
      }
      switchPhase('work');
    }
    saveState();
  };

  const tick = () => {
    if (target_end_timestamp.value) {
      const remaining = Math.round((target_end_timestamp.value - Date.now()) / 1000);
      time_remaining.value = Math.max(0, remaining);
    } else if (time_remaining.value > 0) {
      time_remaining.value -= 1;
    }

    if (time_remaining.value <= 0) {
      time_remaining.value = 0;
      target_end_timestamp.value = null;
      triggerPhaseEnd();
    }
  };

  const start = () => {
    if (status.value === 'running') return;
    if (time_remaining.value <= 0) {
      time_remaining.value = current_duration_seconds.value;
    }
    status.value = 'running';
    target_end_timestamp.value = Date.now() + time_remaining.value * 1000;
    saveState();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    updateDocumentTitle();
  };

  const pause = () => {
    if (status.value !== 'running') return;
    if (target_end_timestamp.value) {
      time_remaining.value = Math.max(0, Math.round((target_end_timestamp.value - Date.now()) / 1000));
    }
    target_end_timestamp.value = null;
    status.value = 'paused';
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    saveState();
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
    target_end_timestamp.value = null;
    status.value = 'idle';
    time_remaining.value = current_duration_seconds.value;
    saveState();
    updateDocumentTitle();
  };

  const switchPhase = (newPhase: PomodoroPhase) => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    phase.value = newPhase;
    status.value = 'idle';
    target_end_timestamp.value = null;
    time_remaining.value = current_duration_seconds.value;
    saveState();
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
      if (phase.value === 'long_break') {
        completed_cycles.value = 0;
      }
      switchPhase('work');
    }
    saveState();
  };

  const resetCycles = () => {
    completed_cycles.value = 0;
    saveState();
  };

  const setCycle = (index: number) => {
    completed_cycles.value = Math.max(0, index);
    saveState();
  };

  const setDurations = (config: {
    work?: number;
    short_break?: number;
    long_break?: number;
    long_break_interval?: number;
    sound_enabled?: boolean;
  }) => {
    if (config.work && config.work > 0) work_duration.value = Math.max(1, Math.floor(Number(config.work)) || 25);
    if (config.short_break && config.short_break > 0) short_break_duration.value = Math.max(1, Math.floor(Number(config.short_break)) || 5);
    if (config.long_break && config.long_break > 0) long_break_duration.value = Math.max(1, Math.floor(Number(config.long_break)) || 15);
    if (config.long_break_interval && config.long_break_interval > 0) {
      long_break_interval.value = Math.max(1, Math.min(12, Math.floor(Number(config.long_break_interval)) || 4));
    }
    if (typeof config.sound_enabled === 'boolean') sound_enabled.value = config.sound_enabled;

    saveSettings();

    if (status.value === 'idle') {
      time_remaining.value = current_duration_seconds.value;
      saveState();
    }
  };

  const openBar = () => {
    is_bar_open.value = true;
    saveState();
  };

  const closeBar = () => {
    is_bar_open.value = false;
    saveState();
  };

  const toggleBar = () => {
    is_bar_open.value = !is_bar_open.value;
    saveState();
  };

  // Re-sync timer when tab/PWA becomes active again
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && status.value === 'running' && target_end_timestamp.value) {
        const remaining = Math.round((target_end_timestamp.value - Date.now()) / 1000);
        if (remaining <= 0) {
          time_remaining.value = 0;
          target_end_timestamp.value = null;
          triggerPhaseEnd();
        } else {
          time_remaining.value = remaining;
          updateDocumentTitle();
        }
      }
    });
  }

  // Resume interval if initialized in running state from storage
  if (status.value === 'running') {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
  }

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
    target_end_timestamp,

    // Getters
    current_duration_seconds,
    formatted_time,
    progress_percent,
    current_cycle_index,
    is_next_break_long,

    // Actions
    start,
    pause,
    toggle,
    reset,
    skip,
    switchPhase,
    setDurations,
    resetCycles,
    setCycle,
    openBar,
    closeBar,
    toggleBar,
  };
});
