import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MobileNavBar from '../MobileNavBar.vue';
import { useModalStore } from '@/stores/modal';
import { useSettingsStore } from '@/stores/settings';
import { usePomodoroStore } from '@/stores/pomodoro';
import { useUiStore } from '@/stores/ui';

const mockPush = vi.fn();

vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'board',
    params: {
      projectId: 'proj-123',
    },
    meta: {
      backRoute: 'board',
    },
    query: {},
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/utils/haptics', () => ({
  triggerLightHaptic: vi.fn(),
  triggerMediumHaptic: vi.fn(),
  triggerSuccessHaptic: vi.fn(),
}));

let pinia: any;

beforeAll(() => {
  pinia = createPinia();
  setActivePinia(pinia);
});

beforeEach(() => {
  setActivePinia(pinia);
  mockPush.mockClear();
});

describe('MobileNavBar.vue', () => {
  it('renders mobile navigation buttons and handles clicks', async () => {
    const wrapper = mount(MobileNavBar);
    expect(wrapper.exists()).toBe(true);

    const navButtons = wrapper.findAll('nav button');
    expect(navButtons.length).toBe(5);

    // 1. Click Board button
    const boardBtn = navButtons[0];
    await boardBtn.trigger('click');
    expect(mockPush).toHaveBeenCalledWith({
      name: 'board',
      params: { projectId: 'proj-123' },
      query: {},
    });

    // 2. Click Quick Add FAB
    const modalStore = useModalStore();
    const openCreateSpy = vi.spyOn(modalStore, 'openTaskCreate');
    const fabBtn = navButtons[2];
    await fabBtn.trigger('click');
    expect(openCreateSpy).toHaveBeenCalledWith('todo');

    // 3. Click Pomodoro button
    const pomodoroStore = usePomodoroStore();
    const pomodoroToggleSpy = vi.spyOn(pomodoroStore, 'toggleBar');
    const pomodoroBtn = navButtons[3];
    await pomodoroBtn.trigger('click');
    expect(pomodoroToggleSpy).toHaveBeenCalled();

    // 4. Click Timeblock button
    const settingsStore = useSettingsStore();
    const timeblockToggleSpy = vi.spyOn(settingsStore, 'toggleTimeblockSidebar');
    const timeblockBtn = navButtons[4];
    await timeblockBtn.trigger('click');
    expect(timeblockToggleSpy).toHaveBeenCalled();
  });

  it('opens views bottom sheet and navigates to selected view', async () => {
    const uiStore = useUiStore();
    uiStore.isMobileViewsSheetOpen = false;

    const wrapper = mount(MobileNavBar);
    const navButtons = wrapper.findAll('nav button');
    const viewsBtn = navButtons[1]; // Ansichten

    // Open sheet
    await viewsBtn.trigger('click');
    expect(uiStore.isMobileViewsSheetOpen).toBe(true);
    await wrapper.vm.$nextTick();

    // Find and click Matrix view inside bottom sheet
    const sheetButtons = wrapper.findAll('.space-y-1\\.5 button');
    const matrixBtn = sheetButtons.find((b) => b.text().includes('Matrix'));
    expect(matrixBtn).toBeDefined();

    await matrixBtn!.trigger('click');
    expect(mockPush).toHaveBeenCalledWith({
      name: 'matrix',
      params: { projectId: 'proj-123' },
      query: {},
    });
    expect(uiStore.isMobileViewsSheetOpen).toBe(false);
  });
});
