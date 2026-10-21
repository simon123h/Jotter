import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SavedViewModal from '../SavedViewModal.vue';
import { useSettingsStore } from '@/stores/settings';

const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

const mountModal = (props: Record<string, unknown>) =>
  mount(SavedViewModal, { props: { isOpen: true, ...props }, global: { stubs: { Teleport: true } } });

describe('SavedViewModal.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    push.mockClear();
  });

  it('saves a search under a name, and opens the new view', async () => {
    const wrapper = mountModal({ initialQuery: 'project:jotter planned:after:today' });
    const settings = useSettingsStore();
    settings.views = [];
    expect((wrapper.find('[data-testid="view-query"]').element as HTMLInputElement).value).toBe('project:jotter planned:after:today');

    await wrapper.find('[data-testid="view-name"]').setValue('Jotter ahead');
    await wrapper.find('form').trigger('submit');

    expect(settings.views).toEqual([{ id: 'jotter-ahead', name: 'Jotter ahead', query: 'project:jotter planned:after:today' }]);
    expect(push).toHaveBeenCalledWith({ name: 'list', params: { projectId: 'all' }, query: { project: 'jotter', planned_after: 'today' } });
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('does not save without a name or a search', async () => {
    const wrapper = mountModal({ initialQuery: '' });
    expect(wrapper.find('[data-testid="view-save"]').attributes('disabled')).toBeDefined();
  });

  it('changes and deletes a view', async () => {
    const settings = useSettingsStore();
    settings.views = [{ id: 'a', name: 'A', query: 'tag:ui' }];
    const wrapper = mountModal({ view: settings.views[0] });
    await wrapper.find('[data-testid="view-name"]').setValue('Renamed');
    await wrapper.find('form').trigger('submit');
    expect(settings.views).toEqual([{ id: 'a', name: 'Renamed', query: 'tag:ui' }]);
    expect(push).not.toHaveBeenCalled();

    const again = mountModal({ view: settings.views[0] });
    await again.find('[data-testid="view-delete"]').trigger('click');
    expect(settings.views).toEqual([]);
  });
});
