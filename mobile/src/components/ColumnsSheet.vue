<script setup lang="ts">
import { ref } from 'vue';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const newTitle = ref('');
const editing = ref<string | null>(null);
const editTitle = ref('');

/** Runs a change and shows what went wrong, such as a column that still has tasks. */
async function attempt(action: () => Promise<void>) {
  try {
    await action();
  } catch (err) {
    ui.showToast(err instanceof Error ? err.message : String(err));
  }
}

function startRename(name: string, title: string) {
  editing.value = name;
  editTitle.value = title;
}

async function saveRename() {
  const name = editing.value;
  editing.value = null;
  if (name) await attempt(() => app.renameColumn(name, editTitle.value));
}

async function create() {
  const title = newTitle.value.trim();
  if (!title) return;
  await attempt(async () => {
    await app.addColumn(title);
    newTitle.value = '';
  });
}

const arrow = 'rounded-full p-2 text-muted active:bg-line disabled:opacity-30';
</script>

<template>
  <BottomSheet :title="t('columns.title')" @close="ui.close()">
    <ul class="space-y-1">
      <li v-for="(b, i) in app.buckets" :key="b.name" class="flex items-center gap-1" data-testid="column-row">
        <form v-if="editing === b.name" class="flex flex-1 gap-2" @submit.prevent="saveRename">
          <input
            v-model="editTitle"
            class="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2"
            data-testid="column-edit"
            autofocus
          />
          <button type="submit" class="rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink">{{ t('common.save') }}</button>
        </form>
        <template v-else>
          <span class="min-w-0 flex-1 truncate px-3 py-3 text-base" :title="b.is_default ? t('columns.default') : undefined">
            {{ b.title }}
          </span>
          <button
            :class="arrow"
            :disabled="i === 0"
            :aria-label="t('columns.moveUp')"
            data-testid="column-up"
            @click="attempt(() => app.moveColumn(b.name, -1))"
          >
            <ChevronUp class="h-4 w-4" />
          </button>
          <button
            :class="arrow"
            :disabled="i === app.buckets.length - 1"
            :aria-label="t('columns.moveDown')"
            data-testid="column-down"
            @click="attempt(() => app.moveColumn(b.name, 1))"
          >
            <ChevronDown class="h-4 w-4" />
          </button>
          <button :class="arrow" :aria-label="t('columns.rename')" data-testid="column-rename" @click="startRename(b.name, b.title)">
            <Pencil class="h-4 w-4" />
          </button>
          <button
            v-if="!b.is_default"
            :class="arrow"
            :aria-label="t('common.delete')"
            data-testid="column-delete"
            @click="attempt(() => app.removeColumn(b.name))"
          >
            <Trash2 class="h-4 w-4" />
          </button>
          <span v-else class="w-8"></span>
        </template>
      </li>
    </ul>

    <form class="mt-3 flex gap-2 border-t border-line pt-3" @submit.prevent="create">
      <input
        v-model="newTitle"
        :placeholder="t('columns.namePlaceholder')"
        class="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-accent"
        data-testid="new-column-input"
      />
      <button
        type="submit"
        class="inline-flex items-center gap-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
        :disabled="!newTitle.trim()"
        data-testid="new-column-submit"
      >
        <Plus class="h-4 w-4" />{{ t('columns.new') }}
      </button>
    </form>
  </BottomSheet>
</template>
