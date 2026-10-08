<script setup lang="ts">
import { computed, ref } from 'vue';
import { X } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';

const app = useAppStore();
const ui = useUiStore();
const actions = useTaskActions();

const text = ref('');

const selectedTasks = computed(() => app.selection.map((id) => app.taskById(id)).filter((task) => !!task));
/** The tags on the selected tasks, with how many of them carry each. */
const onTasks = computed(() => {
  const counts = new Map<string, number>();
  for (const task of selectedTasks.value) for (const tag of task!.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
});
/** Tags used elsewhere in the project that not every selected task has yet. */
const suggestions = computed(() =>
  app.allTags.filter((tag) => onTasks.value.find(([name]) => name === tag)?.[1] !== selectedTasks.value.length)
);

const parse = (value: string) => [
  ...new Set(
    value
      .split(/[,\s]+/)
      .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
      .filter(Boolean)
  ),
];

async function add(tags: string[]) {
  if (!tags.length) return;
  await actions.addTags([...app.selection], tags);
  text.value = '';
}
</script>

<template>
  <BottomSheet :title="`${t('bulk.tag')} · ${app.selectedCount}`" @close="ui.close()">
    <form class="flex gap-2 pb-3" @submit.prevent="add(parse(text))">
      <input
        v-model="text"
        :placeholder="t('bulk.tagsAdd')"
        autocapitalize="off"
        class="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        data-testid="tags-input"
      />
      <button
        type="submit"
        class="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
        :disabled="!parse(text).length"
        data-testid="tags-add"
      >
        {{ t('task.add') }}
      </button>
    </form>

    <template v-if="onTasks.length">
      <h3 class="mb-2 text-xs font-medium text-muted">{{ t('bulk.tagsOnTasks') }}</h3>
      <div class="mb-4 flex flex-wrap gap-2" data-testid="tags-on-tasks">
        <span v-for="[tag, count] in onTasks" :key="tag" class="inline-flex items-center gap-1 rounded-full bg-line py-1 pl-3 pr-1 text-sm">
          #{{ tag }}<span v-if="count < selectedTasks.length" class="text-xs text-muted">{{ count }}/{{ selectedTasks.length }}</span>
          <button
            class="flex h-6 w-6 items-center justify-center rounded-full text-muted active:bg-black/10"
            :aria-label="t('bulk.removeTag')"
            :data-testid="`tag-remove-${tag}`"
            @click="actions.removeTag([...app.selection], tag)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </template>

    <template v-if="suggestions.length">
      <h3 class="mb-2 text-xs font-medium text-muted">{{ t('bulk.tagsSuggestions') }}</h3>
      <div class="flex flex-wrap gap-2 pb-2">
        <button
          v-for="tag in suggestions"
          :key="tag"
          class="rounded-full border border-line px-3 py-1 text-sm active:bg-line"
          :data-testid="`tag-add-${tag}`"
          @click="add([tag])"
        >
          #{{ tag }}
        </button>
      </div>
    </template>
  </BottomSheet>
</template>
