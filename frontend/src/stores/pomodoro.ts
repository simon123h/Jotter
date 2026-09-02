import { computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useStorage, useDocumentVisibility, useTitle, useIntervalFn } from '@vueuse/core';
import { playPomodoroChime } from '@/utils/sound';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

export const usePomodoroStore = defineStore('pomodoro', () => {
  // Persisted Settings
  const work_duration = useStorage<number>('jotter_pomodoro_work_duration', 25, undefined, { flush: 'sync' });
  const short_break_duration = useStorage<number>('jotter_pomodoro_short_break_duration', 5, undefined, { flush: 'sync' });
  const long_break_duration = useStorage<number>('jotter_pomodoro_long_break_duration', 15, undefined, { flush: 'sync' });
  const long_break_interval = useStorage<number>('jotter_pomodoro_long_break_interval', 4, undefined, { flush: 'sync' });
  const sound_enabled = useStorage<boolean>('jotter_pomodoro_sound_enabled', true, undefined, { flush: 'sync' });
  const auto_proceed = useStorage<boolean>('jotter_pomodoro_auto_proceed', false, undefined, { flush: 'sync' });

  // Persisted Runtime State
  const phase = useStorage<PomodoroPhase>('jotter_pomodoro_phase', 'work', undefined, { flush: 'sync' });
  const status = useStorage<PomodoroStatus>('jotter_pomodoro_status', 'idle', undefined, { flush: 'sync' });
  const time_remaining = useStorage<number>('jotter_pomodoro_time_remaining', work_duration.value * 60, undefined, {
    flush: 'sync',
  });
  const completed_cycles = useStorage<number>('jotter_pomodoro_completed_cycles', 0, undefined, { flush: 'sync' });
  const is_bar_open = useStorage<boolean>('jotter_pomodoro_is_bar_open', false, undefined, { flush: 'sync' });
  const target_end_timestamp = useStorage<number | null>('jotter_pomodoro_target_end_timestamp', null, undefined, {
    flush: 'sync',
  });

  const docTitle = useTitle('Jotter');

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

  // Restore running timer state if persisted target timestamp exists
  if (status.value === 'running' && target_end_timestamp.value) {
    const remaining = Math.round((target_end_timestamp.value - Date.now()) / 1000);
    if (remaining > 0) {
      time_remaining.value = remaining;
    } else {
      time_remaining.value = 0;
      target_end_timestamp.value = null;
      status.value = 'idle';
    }
  }

  const updateDocumentTitle = () => {
    if (status.value === 'running') {
      const emoji = phase.value === 'work' ? '🍅' : '☕';
      docTitle.value = `(${formatted_time.value}) ${emoji} Jotter`;
    } else {
      docTitle.value = 'Jotter';
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
      if (phase.value === 'long_break') {
        completed_cycles.value = 0;
      }
      switchPhase('work');
    }

    if (auto_proceed.value) {
      start();
    }
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

  const { pause: pauseInterval, resume: resumeInterval } = useIntervalFn(tick, 1000, {
    immediate: status.value === 'running',
  });

  const start = () => {
    if (status.value === 'running') return;
    if (time_remaining.value <= 0) {
      time_remaining.value = current_duration_seconds.value;
    }
    status.value = 'running';
    target_end_timestamp.value = Date.now() + time_remaining.value * 1000;
    resumeInterval();
    updateDocumentTitle();
  };

  const pause = () => {
    if (status.value !== 'running') return;
    if (target_end_timestamp.value) {
      time_remaining.value = Math.max(0, Math.round((target_end_timestamp.value - Date.now()) / 1000));
    }
    target_end_timestamp.value = null;
    status.value = 'paused';
    pauseInterval();
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
    pauseInterval();
    status.value = 'idle';
    target_end_timestamp.value = null;
    time_remaining.value = current_duration_seconds.value;
    updateDocumentTitle();
  };

  const switchPhase = (newPhase: PomodoroPhase) => {
    pauseInterval();
    phase.value = newPhase;
    status.value = 'idle';
    target_end_timestamp.value = null;
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
      if (phase.value === 'long_break') {
        completed_cycles.value = 0;
      }
      switchPhase('work');
    }
  };

  const resetCycles = () => {
    completed_cycles.value = 0;
  };

  const setCycle = (index: number) => {
    completed_cycles.value = Math.max(0, index);
  };

  const setDurations = (config: {
    work?: number;
    short_break?: number;
    long_break?: number;
    long_break_interval?: number;
    sound_enabled?: boolean;
    auto_proceed?: boolean;
  }) => {
    if (config.work && config.work > 0) work_duration.value = Math.max(1, Math.floor(Number(config.work)) || 25);
    if (config.short_break && config.short_break > 0) short_break_duration.value = Math.max(1, Math.floor(Number(config.short_break)) || 5);
    if (config.long_break && config.long_break > 0) long_break_duration.value = Math.max(1, Math.floor(Number(config.long_break)) || 15);
    if (config.long_break_interval && config.long_break_interval > 0) {
      long_break_interval.value = Math.max(1, Math.min(12, Math.floor(Number(config.long_break_interval)) || 4));
    }
    if (typeof config.sound_enabled === 'boolean') sound_enabled.value = config.sound_enabled;
    if (typeof config.auto_proceed === 'boolean') auto_proceed.value = config.auto_proceed;

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

  // Re-sync timer when tab/PWA becomes active again
  const visibility = useDocumentVisibility();
  watch(visibility, (current) => {
    if (current === 'visible' && status.value === 'running' && target_end_timestamp.value) {
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
    auto_proceed,
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
