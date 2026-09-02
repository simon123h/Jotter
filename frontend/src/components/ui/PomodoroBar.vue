<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Play, Pause, RotateCcw, SkipForward, Settings as SettingsIcon, X, Volume2, VolumeX, Check } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { usePomodoroStore, type PomodoroPhase } from '@/stores/pomodoro';

const { t } = useI18n();
const pomodoroStore = usePomodoroStore();

const showSettings = ref(false);
const editWorkDuration = ref(pomodoroStore.work_duration);
const editShortBreak = ref(pomodoroStore.short_break_duration);
const editLongBreak = ref(pomodoroStore.long_break_duration);
const editSound = ref(pomodoroStore.sound_enabled);

const toggleSettings = () => {
  if (!showSettings.value) {
    editWorkDuration.value = pomodoroStore.work_duration;
    editShortBreak.value = pomodoroStore.short_break_duration;
    editLongBreak.value = pomodoroStore.long_break_duration;
    editSound.value = pomodoroStore.sound_enabled;
  }
  showSettings.value = !showSettings.value;
};

const saveSettings = () => {
  pomodoroStore.setDurations({
    work: Number(editWorkDuration.value) || 25,
    short_break: Number(editShortBreak.value) || 5,
    long_break: Number(editLongBreak.value) || 15,
    sound_enabled: editSound.value,
  });
  showSettings.value = false;
};

const selectPhase = (p: PomodoroPhase) => {
  pomodoroStore.switchPhase(p);
};

const handleKeydown = (e: KeyboardEvent) => {
  if (!pomodoroStore.is_bar_open) return;
  const target = e.target as HTMLElement;
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    pomodoroStore.toggle();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <transition name="slide-up">
    <div v-if="pomodoroStore.is_bar_open" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] w-max max-w-[96vw]">
      <!-- Settings Popover -->
      <transition name="fade">
        <div
          v-if="showSettings"
          class="mb-3 p-4 bg-theme-base border border-theme-border rounded-xl shadow-2xl space-y-3.5 backdrop-blur-md text-xs select-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div class="flex items-center justify-between pb-2 border-b border-theme-border/60">
            <span class="font-bold text-theme-text-main text-sm flex items-center gap-1.5">
              <SettingsIcon class="w-4 h-4 text-theme-primary" />
              {{ t('pomodoro.settings') }}
            </span>
            <button
              @click="showSettings = false"
              class="p-1 rounded-md text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 cursor-pointer"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="grid grid-cols-3 gap-2.5">
            <div>
              <label class="block text-[11px] font-semibold text-theme-text-muted mb-1">
                {{ t('pomodoro.workDuration') }}
              </label>
              <input
                v-model.number="editWorkDuration"
                type="number"
                min="1"
                max="120"
                class="w-full bg-theme-card border border-theme-border rounded-md px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-theme-text-muted mb-1">
                {{ t('pomodoro.shortBreakDuration') }}
              </label>
              <input
                v-model.number="editShortBreak"
                type="number"
                min="1"
                max="60"
                class="w-full bg-theme-card border border-theme-border rounded-md px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-theme-text-muted mb-1">
                {{ t('pomodoro.longBreakDuration') }}
              </label>
              <input
                v-model.number="editLongBreak"
                type="number"
                min="1"
                max="90"
                class="w-full bg-theme-card border border-theme-border rounded-md px-2.5 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
              />
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <label class="flex items-center gap-2 cursor-pointer text-theme-text-main">
              <input
                type="checkbox"
                v-model="editSound"
                class="rounded border-theme-border text-theme-primary focus:ring-theme-ring cursor-pointer"
              />
              <span class="flex items-center gap-1">
                <Volume2 v-if="editSound" class="w-3.5 h-3.5 text-theme-primary" />
                <VolumeX v-else class="w-3.5 h-3.5 text-theme-text-muted" />
                {{ t('pomodoro.sound') }}
              </span>
            </label>

            <button
              @click="saveSettings"
              class="flex items-center gap-1 px-3 py-1.5 bg-theme-primary text-white font-semibold rounded-md hover:bg-theme-primary/90 transition-all cursor-pointer shadow-2xs"
            >
              <Check class="w-3.5 h-3.5" />
              {{ t('common.save') || 'Save' }}
            </button>
          </div>
        </div>
      </transition>

      <!-- Main Floating Dock -->
      <div
        class="bg-theme-card/95 backdrop-blur-md border border-theme-border px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-2xl flex flex-col gap-2 relative overflow-hidden min-w-[340px] sm:min-w-[480px] md:min-w-[530px]"
      >
        <!-- Progress Bar Underlay -->
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-theme-column/30 overflow-hidden rounded-b-2xl pointer-events-none">
          <div
            class="h-full transition-all duration-300 rounded-r-full"
            :class="pomodoroStore.phase === 'work' ? 'bg-rose-500' : 'bg-emerald-500'"
            :style="{ width: `${pomodoroStore.progress_percent}%` }"
          ></div>
        </div>

        <!-- Core Toolbar Row -->
        <div class="flex items-center gap-2 sm:gap-3.5 whitespace-nowrap">
          <!-- Phase Switcher Pills -->
          <div class="flex items-center bg-theme-column/40 p-0.5 rounded-xl text-[11px] sm:text-xs font-semibold shrink-0">
            <button
              @click="selectPhase('work')"
              class="px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
              :class="
                pomodoroStore.phase === 'work'
                  ? 'bg-rose-500 text-white shadow-2xs font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/60'
              "
            >
              <span>🍅</span>
              <span>{{ t('pomodoro.focus') }}</span>
            </button>
            <button
              @click="selectPhase('short_break')"
              class="px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
              :class="
                pomodoroStore.phase === 'short_break'
                  ? 'bg-emerald-500 text-white shadow-2xs font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/60'
              "
            >
              <span>☕</span>
              <span>{{ t('pomodoro.shortBreak') }}</span>
            </button>
            <button
              @click="selectPhase('long_break')"
              class="px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
              :class="
                pomodoroStore.phase === 'long_break'
                  ? 'bg-teal-500 text-white shadow-2xs font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/60'
              "
            >
              <span>🌴</span>
              <span>{{ t('pomodoro.longBreak') }}</span>
            </button>
          </div>

          <!-- Digital Countdown Display -->
          <div class="flex items-center justify-center font-mono tracking-tight shrink-0 select-none px-1">
            <span class="text-xl sm:text-2xl font-black text-theme-text-main tabular-nums leading-none">
              {{ pomodoroStore.formatted_time }}
            </span>
          </div>

          <!-- Completed Cycles indicator -->
          <div
            v-if="pomodoroStore.completed_cycles > 0"
            class="hidden lg:flex items-center text-[11px] font-bold text-theme-text-muted px-2 py-0.5 bg-theme-column/30 rounded-md shrink-0"
            :title="t('pomodoro.cyclesCompleted', { count: pomodoroStore.completed_cycles })"
          >
            🍅 ×{{ pomodoroStore.completed_cycles }}
          </div>

          <!-- Action Controls -->
          <div class="flex items-center gap-1.5 ml-auto shrink-0">
            <!-- Play / Pause Button (Fixed Size & Perfectly Centered) -->
            <button
              @click="pomodoroStore.toggle"
              class="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full font-bold transition-all transform active:scale-95 cursor-pointer shadow-md flex items-center justify-center shrink-0"
              :class="
                pomodoroStore.phase === 'work'
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              "
              :title="pomodoroStore.status === 'running' ? t('pomodoro.pause') : t('pomodoro.play')"
              :aria-label="pomodoroStore.status === 'running' ? t('pomodoro.pause') : t('pomodoro.play')"
            >
              <Pause v-if="pomodoroStore.status === 'running'" class="w-4 h-4 fill-current shrink-0" />
              <Play v-else class="w-4 h-4 fill-current shrink-0" />
            </button>

            <!-- Skip to Next Phase Button -->
            <button
              @click="pomodoroStore.skip"
              class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
              :title="t('pomodoro.skip')"
              :aria-label="t('pomodoro.skip')"
            >
              <SkipForward class="w-4 h-4" />
            </button>

            <!-- Reset Timer Button -->
            <button
              @click="pomodoroStore.reset"
              class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
              :title="t('pomodoro.reset')"
              :aria-label="t('pomodoro.reset')"
            >
              <RotateCcw class="w-4 h-4" />
            </button>

            <!-- Settings Toggle Button -->
            <button
              @click="toggleSettings"
              class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
              :class="showSettings ? 'text-theme-primary bg-theme-primary/15' : ''"
              :title="t('pomodoro.settings')"
              :aria-label="t('pomodoro.settings')"
            >
              <SettingsIcon class="w-4 h-4" />
            </button>

            <div class="w-px h-5 bg-theme-border/50 mx-0.5"></div>

            <!-- Close Dock Button -->
            <button
              @click="pomodoroStore.closeBar"
              class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 rounded-full transition-all cursor-pointer"
              :title="t('pomodoro.close')"
              :aria-label="t('pomodoro.close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
  transform: translate(0%, 50%) scale(0.9);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translate(0%, 50%) scale(0.9);
  opacity: 0;
}
</style>
