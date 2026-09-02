import { computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useStorage, useDocumentVisibility } from '@vueuse/core';
import { playPomodoroChime } from '@/utils/sound';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

const SETTINGS_KEY = 'jotter_pomodoro_settings';
const STATE_KEY = 'jotter_pomodoro_state';

interface PomodoroSettingsStorage {
  work_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  long_break_interval: number;
  sound_enabled: boolean;
  auto_proceed: boolean;
}

interface PomodoroStateStorage {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  time_remaining: number;
  completed_cycles: number;
  is_bar_open: boolean;
  target_end_timestamp: number | null;
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  // Persisted Settings via VueUse useStorage (flush sync for immediate persistence)
  const settings = useStorage<PomodoroSettingsStorage>(
    SETTINGS_KEY,
    {
      work_duration: 25,
      short_break_duration: 5,
      long_break_duration: 15,
      long_break_interval: 4,
      sound_enabled: true,
      auto_proceed: false,
    },
    undefined,
    { flush: 'sync', deep: true }
  );

  // Persisted Runtime State via VueUse useStorage
  const persistedState = useStorage<PomodoroStateStorage>(
    STATE_KEY,
    {
      phase: 'work',
      status: 'idle',
      time_remaining: 25 * 60,
      completed_cycles: 0,
      is_bar_open: false,
      target_end_timestamp: null,
    },
    undefined,
    { flush: 'sync', deep: true }
  );

  // Direct reactive property proxies with immutability for useStorage sync
  const work_duration = computed({
    get: () => settings.value.work_duration ?? 25,
    set: (v) => {
      settings.value = {
        ...settings.value,
        work_duration: Math.max(1, Number(v) || 25),
      };
    },
  });

  const short_break_duration = computed({
    get: () => settings.value.short_break_duration ?? 5,
    set: (v) => {
      settings.value = {
        ...settings.value,
        short_break_duration: Math.max(1, Number(v) || 5),
      };
    },
  });

  const long_break_duration = computed({
    get: () => settings.value.long_break_duration ?? 15,
    set: (v) => {
      settings.value = {
        ...settings.value,
        long_break_duration: Math.max(1, Number(v) || 15),
      };
    },
  });

  const long_break_interval = computed({
    get: () => settings.value.long_break_interval ?? 4,
    set: (v) => {
      settings.value = {
        ...settings.value,
        long_break_interval: Math.max(1, Math.min(12, Math.floor(Number(v)) || 4)),
      };
    },
  });

  const sound_enabled = computed({
    get: () => settings.value.sound_enabled ?? true,
    set: (v) => {
      settings.value = {
        ...settings.value,
        sound_enabled: Boolean(v),
      };
    },
  });

  const auto_proceed = computed({
    get: () => settings.value.auto_proceed ?? false,
    set: (v) => {
      settings.value = {
        ...settings.value,
        auto_proceed: Boolean(v),
      };
    },
  });

  const phase = computed({
    get: () => persistedState.value.phase ?? 'work',
    set: (v) => {
      persistedState.value = {
        ...persistedState.value,
        phase: v,
      };
    },
  });

  const status = computed({
    get: () => persistedState.value.status ?? 'idle',
    set: (v) => {
      persistedState.value = {
        ...persistedState.value,
        status: v,
      };
    },
  });

  const time_remaining = computed({
    get: () => persistedState.value.time_remaining ?? work_duration.value * 60,
    set: (v) => {
      persistedState.value = {
        ...persistedState.value,
        time_remaining: v,
      };
    },
  });

  const completed_cycles = computed({
    get: () => persistedState.value.completed_cycles ?? 0,
    set: (v) => {
      persistedState.value = {
        ...persistedState.value,
        completed_cycles: v,
      };
    },
  });

  const is_bar_open = computed({
    get: () => persistedState.value.is_bar_open ?? false,
    set: (v) => {
      persistedState.value = {
        ...persistedState.value,
        is_bar_open: v,
      };
    },
  });

  const target_end_timestamp = computed({
    get: () => persistedState.value.target_end_timestamp ?? null,
    set: (v) => {
      persistedState.value = {
        ...persistedState.value,
        target_end_timestamp: v,
      };
    },
  });

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  const originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'Jotter';

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
  if (persistedState.value.status === 'running' && persistedState.value.target_end_timestamp) {
    const remaining = Math.round((persistedState.value.target_end_timestamp - Date.now()) / 1000);
    if (remaining > 0) {
      persistedState.value = {
        ...persistedState.value,
        time_remaining: remaining,
      };
    } else {
      persistedState.value = {
        ...persistedState.value,
        time_remaining: 0,
        target_end_timestamp: null,
        status: 'idle',
      };
    }
  }

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
      const newCycles = completed_cycles.value + 1;
      if (newCycles % long_break_interval.value === 0) {
        completed_cycles.value = newCycles;
        switchPhase('long_break');
      } else {
        completed_cycles.value = newCycles;
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

  const start = () => {
    if (status.value === 'running') return;
    if (time_remaining.value <= 0) {
      time_remaining.value = current_duration_seconds.value;
    }
    const target = Date.now() + time_remaining.value * 1000;
    persistedState.value = {
      ...persistedState.value,
      status: 'running',
      target_end_timestamp: target,
    };

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    updateDocumentTitle();
  };

  const pause = () => {
    if (status.value !== 'running') return;
    const remaining = target_end_timestamp.value
      ? Math.max(0, Math.round((target_end_timestamp.value - Date.now()) / 1000))
      : time_remaining.value;

    persistedState.value = {
      ...persistedState.value,
      status: 'paused',
      target_end_timestamp: null,
      time_remaining: remaining,
    };

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
    persistedState.value = {
      ...persistedState.value,
      status: 'idle',
      target_end_timestamp: null,
      time_remaining: current_duration_seconds.value,
    };
    updateDocumentTitle();
  };

  const switchPhase = (newPhase: PomodoroPhase) => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    let durationSec = work_duration.value * 60;
    if (newPhase === 'short_break') durationSec = short_break_duration.value * 60;
    if (newPhase === 'long_break') durationSec = long_break_duration.value * 60;

    persistedState.value = {
      ...persistedState.value,
      phase: newPhase,
      status: 'idle',
      target_end_timestamp: null,
      time_remaining: durationSec,
    };
    updateDocumentTitle();
  };

  const skip = () => {
    if (phase.value === 'work') {
      const nextCycles = completed_cycles.value + 1;
      completed_cycles.value = nextCycles;
      if (nextCycles % long_break_interval.value === 0) {
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
    const nextSettings = { ...settings.value };
    if (config.work && config.work > 0) nextSettings.work_duration = Math.max(1, Math.floor(Number(config.work)) || 25);
    if (config.short_break && config.short_break > 0)
      nextSettings.short_break_duration = Math.max(1, Math.floor(Number(config.short_break)) || 5);
    if (config.long_break && config.long_break > 0)
      nextSettings.long_break_duration = Math.max(1, Math.floor(Number(config.long_break)) || 15);
    if (config.long_break_interval && config.long_break_interval > 0) {
      nextSettings.long_break_interval = Math.max(1, Math.min(12, Math.floor(Number(config.long_break_interval)) || 4));
    }
    if (typeof config.sound_enabled === 'boolean') nextSettings.sound_enabled = config.sound_enabled;
    if (typeof config.auto_proceed === 'boolean') nextSettings.auto_proceed = config.auto_proceed;
    settings.value = nextSettings;

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
