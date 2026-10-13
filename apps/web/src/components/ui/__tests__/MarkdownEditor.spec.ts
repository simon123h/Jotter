import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import MarkdownEditor from '../MarkdownEditor.vue';

describe('MarkdownEditor.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('wraps long lines instead of scrolling sideways', () => {
    const wrapper = mount(MarkdownEditor, { props: { modelValue: 'a long line '.repeat(50) }, attachTo: document.body });

    expect(wrapper.find('.cm-content').classes()).toContain('cm-lineWrapping');
    wrapper.unmount();
  });
});
