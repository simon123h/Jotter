<script setup lang="ts">
import { ref } from 'vue';
import { Plus, Pencil, Pin, Trash2, Database } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const newTitle = ref('');
const editing = ref<string | null>(null);
const editTitle = ref('');

const fail = (err: unknown) => ui.showToast(err instanceof Error ? err.message : String(err));

async function select(id: string) {
  await app.selectProject(id);
  ui.close();
}

async function create() {
  const title = newTitle.value.trim();
  if (!title) return;
  try {
    await app.addProject(title);
    newTitle.value = '';
    ui.close();
  } catch (err) {
    fail(err);
  }
}

function startRename(id: string, title: string) {
  editing.value = id;
  editTitle.value = title;
}

async function saveRename() {
  const id = editing.value;
  editing.value = null;
  if (!id || !editTitle.value.trim()) return;
  try {
    await app.renameProject(id, editTitle.value);
  } catch (err) {
    fail(err);
  }
}

async function remove(id: string, title: string) {
  if (!window.confirm(t('projects.confirmDelete', { name: title }))) return;
  try {
    await app.removeProject(id);
  } catch (err) {
    fail(err);
  }
}
</script>

<template>
  <BottomSheet :title="t('projects.title')" @close="ui.close()">
    <ul class="space-y-1">
      <li v-for="p in app.orderedProjects" :key="p.id" class="flex items-center gap-1" data-testid="project-row">
        <form v-if="editing === p.id" class="flex flex-1 gap-2" @submit.prevent="saveRename">
          <input v-model="editTitle" class="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2" autofocus />
          <button type="submit" class="rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink">{{ t('common.save') }}</button>
        </form>
        <template v-else>
          <button
            class="min-w-0 flex-1 truncate rounded-lg px-3 py-3 text-left text-base active:bg-line"
            :class="p.id === app.projectId ? 'bg-accent/15 font-semibold text-accent' : ''"
            @click="select(p.id)"
          >
            {{ p.title }}
          </button>
          <button
            class="rounded-full p-2 active:bg-line"
            :class="app.pinned.includes(p.id) ? 'text-accent' : 'text-muted'"
            :aria-label="t(app.pinned.includes(p.id) ? 'projects.unpin' : 'projects.pin')"
            :aria-pressed="app.pinned.includes(p.id)"
            data-testid="project-pin"
            @click="app.togglePinned(p.id)"
          >
            <Pin class="h-4 w-4" :class="app.pinned.includes(p.id) ? 'fill-current' : ''" />
          </button>
          <button class="rounded-full p-2 text-muted active:bg-line" :aria-label="t('projects.rename')" @click="startRename(p.id, p.title)">
            <Pencil class="h-4 w-4" />
          </button>
          <button class="rounded-full p-2 text-muted active:bg-line" :aria-label="t('common.delete')" @click="remove(p.id, p.title)">
            <Trash2 class="h-4 w-4" />
          </button>
        </template>
      </li>
    </ul>

    <form class="mt-3 flex gap-2 border-t border-line pt-3" @submit.prevent="create">
      <input
        v-model="newTitle"
        :placeholder="t('projects.namePlaceholder')"
        class="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-accent"
        data-testid="new-project-input"
      />
      <button
        type="submit"
        class="inline-flex items-center gap-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
        :disabled="!newTitle.trim()"
        data-testid="new-project-submit"
      >
        <Plus class="h-4 w-4" />{{ t('projects.new') }}
      </button>
    </form>

    <button class="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted" @click="ui.open({ type: 'vaults' })">
      <Database class="h-4 w-4" />{{ app.vault?.name }} · {{ t('vaults.title') }}
    </button>
  </BottomSheet>
</template>
