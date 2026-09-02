import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PomodoroBar from '@/components/ui/PomodoroBar.vue';
import { usePomodoroStore } from '@/stores/pomodoro';

vi.mock('@/utils/sound', () => ({
  playPomodoroChime: vi.fn(),
}));

describe('PomodoroBar.vue', () => {
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  it('does not render dock when is_bar_open is false', () => {
    const store = usePomodoroStore();
    store.is_bar_open = false;

    const wrapper = mount(PomodoroBar, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find('.tabular-nums').exists()).toBe(false);
  });

  it('renders time, phase switcher, and controls when bar is open', () => {
    const store = usePomodoroStore();
    store.is_bar_open = true;

    const wrapper = mount(PomodoroBar, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find('.tabular-nums').text()).toBe('25:00');
    expect(wrapper.text()).toContain('Focus');
    expect(wrapper.text()).toContain('Short Break');
  });

  it('triggers start/pause toggle on play button click', async () => {
    const store = usePomodoroStore();
    store.is_bar_open = true;
    const toggleSpy = vi.spyOn(store, 'toggle');

    const wrapper = mount(PomodoroBar, {
      global: {
        plugins: [pinia],
      },
    });

    const playBtn = wrapper.find('button[aria-label="Start timer"]');
    expect(playBtn.exists()).toBe(true);
    await playBtn.trigger('click');

    expect(toggleSpy).toHaveBeenCalled();
  });

  it('switches phases on phase button click', async () => {
    const store = usePomodoroStore();
    store.is_bar_open = true;
    const switchSpy = vi.spyOn(store, 'switchPhase');

    const wrapper = mount(PomodoroBar, {
      global: {
        plugins: [pinia],
      },
    });

    const breakButtons = wrapper.findAll('.flex.items-center.bg-theme-column\\/40 button');
    // Index 1 is Short Break
    await breakButtons[1].trigger('click');
    expect(switchSpy).toHaveBeenCalledWith('short_break');
  });

  it('maintains anchored bottom-6 position', () => {
    const store = usePomodoroStore();
    store.is_bar_open = true;

    const wrapper = mount(PomodoroBar, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find('.fixed').classes()).toContain('bottom-6');
    const playBtn = wrapper.find('button[aria-label="Start timer"]');
    expect(playBtn.classes()).toContain('w-8');
  });
});
