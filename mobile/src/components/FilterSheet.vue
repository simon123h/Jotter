<script setup lang="ts">
import { computed } from 'vue';
import { stringifyQuery, type TaskFilter } from '@jotter/task-filter';
import BottomSheet from './BottomSheet.vue';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();
const priorities = ['low', 'medium', 'high', 'urgent'] as const;
const field = 'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent';

/** The controls write into the search field's query, and show what it says, the way the desktop's filter does. */
function update(patch: Partial<TaskFilter>) {
  app.query = stringifyQuery({ ...app.parsedFilter, ...patch });
}

const priority = computed({
  get: () => app.parsedFilter.priorities ?? '',
  set: (value: string) => update({ priorities: value || undefined }),
});
const tag = computed({
  get: () => app.parsedFilter.tags ?? '',
  set: (value: string) => update({ tags: value || undefined, tag_mode: 'any' }),
});
const due = computed({
  get: () => (app.parsedFilter.has_due_date === true ? 'has' : app.parsedFilter.has_due_date === false ? 'none' : ''),
  set: (value: string) => update({ has_due_date: value === 'has' ? true : value === 'none' ? false : undefined }),
});

/** A value typed in the search field that the list does not offer (several priorities, a tag no task has) stays selectable. */
const typedPriority = computed(() => (priority.value && !(priorities as readonly string[]).includes(priority.value) ? priority.value : ''));
const typedTag = computed(() => (tag.value && !app.allTags.includes(tag.value) ? tag.value : ''));
</script>

<template>
  <BottomSheet :title="t('search.filters')" @close="ui.close()">
    <div class="space-y-3 pb-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('filter.priority') }}</span>
        <select v-model="priority" :class="field" data-testid="filter-priority">
          <option value="">{{ t('filter.anyPriority') }}</option>
          <option v-for="p in priorities" :key="p" :value="p">{{ t(`priority.${p}` as MessageKey) }}</option>
          <option v-if="typedPriority" :value="typedPriority">{{ typedPriority }}</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('filter.tag') }}</span>
        <select v-model="tag" :class="field" data-testid="filter-tag">
          <option value="">{{ t('filter.anyTag') }}</option>
          <option v-for="name in app.allTags" :key="name" :value="name">#{{ name }}</option>
          <option v-if="typedTag" :value="typedTag">{{ typedTag }}</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('task.due') }}</span>
        <select v-model="due" :class="field" data-testid="filter-due">
          <option value="">{{ t('filter.anyDue') }}</option>
          <option value="has">{{ t('filter.hasDue') }}</option>
          <option value="none">{{ t('filter.noDue') }}</option>
        </select>
      </label>
      <button v-if="app.isFiltering" class="text-sm font-medium text-accent" data-testid="filter-clear" @click="app.resetFilter()">
        {{ t('filter.clear') }}
      </button>
      <p class="rounded-xl bg-surface px-3 py-2 text-xs leading-relaxed text-muted" data-testid="filter-syntax">
        {{ t('filter.syntax') }}
      </p>
    </div>
  </BottomSheet>
</template>
