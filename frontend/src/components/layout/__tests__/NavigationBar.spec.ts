import { describe, it, expect, vi, beforeAll } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NavigationBar from '../NavigationBar.vue';

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
      { id: '1', title: 'Project 1' },
      { id: '2', title: 'Project 2' },
    ],
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
});
