import { describe, it, expect, vi, beforeAll } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NavigationBar from '../NavigationBar.vue';
import type { Project } from '@/types';

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'board',
    meta: {
      backRoute: 'board',
    },
    query: {},
  }),
}));

beforeAll(() => {
  setActivePinia(createPinia());
});

describe('NavigationBar.vue', () => {
  const defaultProps = {
    modelValue: '',
    isSidebarOpen: true,
    projects: [
      { id: '1', title: 'Project 1', created_at: '2026-06-08T00:00:00Z' },
      { id: '2', title: 'Project 2', created_at: '2026-06-08T00:00:00Z' },
    ] as Project[],
    activeProjectId: '1',
    hasActiveFilters: false,
    defaultBucketName: 'todo' as const,
  };

  const mountOptions = {
    props: defaultProps,
    global: {
      mocks: {
        $route: {
          query: {},
        },
      },
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  };

  it('renders correctly and has a search input', () => {
    const wrapper = mount(NavigationBar, mountOptions);

    const searchInput = wrapper.find('input[type="text"]');
    expect(searchInput.exists()).toBe(true);
  });

  it('blurs (unfocuses) the search input on Escape keypress', async () => {
    const wrapper = mount(NavigationBar, mountOptions);

    const searchInput = wrapper.find('input[type="text"]');
    const inputEl = searchInput.element as HTMLInputElement;

    // Spy on the blur method of the native input element
    const blurSpy = vi.spyOn(inputEl, 'blur');

    // Trigger keydown.esc
    await searchInput.trigger('keydown.esc');

    expect(blurSpy).toHaveBeenCalled();
  });

  it('toggles overflow menu on click', async () => {
    const wrapper = mount(NavigationBar, mountOptions);

    expect(wrapper.find('.overflow-menu-container').exists()).toBe(true);
    expect(wrapper.find('.overflow-menu-container .absolute').exists()).toBe(false);

    const toggleBtn = wrapper.find('.overflow-menu-container button');
    await toggleBtn.trigger('click');

    expect(wrapper.find('.overflow-menu-container .absolute').exists()).toBe(true);
  });

  it('emits export-tasks with xlsx when clicking the Excel export button', async () => {
    const wrapper = mount(NavigationBar, mountOptions);
    const toggleBtn = wrapper.find('.overflow-menu-container button');
    await toggleBtn.trigger('click');

    const buttons = wrapper.findAll('.overflow-menu-container button');
    const excelBtn = buttons.find((b) => b.text().includes('Excel'));
    expect(excelBtn).toBeDefined();
    await excelBtn!.trigger('click');

    expect(wrapper.emitted('export-tasks')).toBeTruthy();
    expect(wrapper.emitted('export-tasks')![0]).toEqual(['xlsx']);
  });

  it('emits export-tasks with csv when clicking the CSV export button', async () => {
    const wrapper = mount(NavigationBar, mountOptions);
    const toggleBtn = wrapper.find('.overflow-menu-container button');
    await toggleBtn.trigger('click');

    const buttons = wrapper.findAll('.overflow-menu-container button');
    const csvBtn = buttons.find((b) => b.text().includes('CSV'));
    expect(csvBtn).toBeDefined();
    await csvBtn!.trigger('click');

    expect(wrapper.emitted('export-tasks')).toBeTruthy();
    expect(wrapper.emitted('export-tasks')![0]).toEqual(['csv']);
  });

  it('emits toggle-timebox-sidebar when clicking the timebox sidebar button', async () => {
    const wrapper = mount(NavigationBar, mountOptions);
    const timeboxBtn = wrapper.findAll('button').find((b) => b.text().includes('Time Blocking'));
    expect(timeboxBtn).toBeDefined();
    await timeboxBtn!.trigger('click');

    expect(wrapper.emitted('toggle-timebox-sidebar')).toBeTruthy();
  });
});
