import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

describe('App', () => {
  it('renders and reaches the shared vault format package', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Jotter Lite');
    expect(wrapper.get('[data-testid="bucket-names"]').text()).toContain('Backlog');
  });
});
