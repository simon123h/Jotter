<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue';
import { Trash2, Paperclip, Pencil, X } from '@lucide/vue';
import MarkdownView from './MarkdownView.vue';
import { toggleChecklistItem } from '@/markdown';
import BottomSheet from './BottomSheet.vue';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ id: string }>();
const app = useAppStore();
const ui = useUiStore();

const task = computed(() => app.taskById(props.id));
const priorities = ['low', 'medium', 'high', 'urgent'] as const;
const field = 'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent';

const parseTags = (text: string) =>
  text
    .split(',')
    .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
    .filter((tag) => tag && !/\s/.test(tag));

// The sheet edits a draft; it is written back on every change and once more when the sheet closes
const initial = task.value;
const draft = ref({
  title: initial?.title ?? '',
  bucket: initial?.bucket ?? '',
  priority: initial?.priority ?? '',
  due: initial?.due_date ?? '',
  tags: (initial?.tags ?? []).join(', '),
  body: initial?.body ?? '',
});

const fail = (err: unknown) => ui.showToast(err instanceof Error ? err.message : String(err));
let closing = false;

async function save() {
  const current = task.value;
  if (!current || closing) return;
  const d = draft.value;
  const tags = parseTags(d.tags);
  const changes: Parameters<typeof app.saveTask>[1] = {};
  if (d.title.trim() && d.title.trim() !== current.title) changes.title = d.title.trim();
  if ((d.priority || undefined) !== current.priority) changes.priority = d.priority || undefined;
  if ((d.due || undefined) !== current.due_date) changes.due_date = d.due || undefined;
  if (tags.join(',') !== current.tags.join(',')) changes.tags = tags;
  if (d.body !== current.body) changes.body = d.body;
  try {
    if (Object.keys(changes).length) await app.saveTask(props.id, changes);
    if (d.bucket && d.bucket !== current.bucket) await app.moveTask(props.id, d.bucket);
  } catch (err) {
    fail(err);
  }
}

// Let v-model apply the new value before it is read
const saveSoon = () => void nextTick().then(save);

async function close() {
  await save();
  ui.close();
}

// Back button or a tap outside while a field still has focus: nothing is lost
onBeforeUnmount(() => {
  void save();
});

async function remove() {
  if (!window.confirm(t('task.confirmDelete'))) return;
  closing = true;
  try {
    await app.removeTask(props.id);
    ui.close();
    ui.showToast(t('task.deleted'));
  } catch (err) {
    closing = false;
    fail(err);
  }
}

// Notes are shown rendered; they open in the editor when empty, or when Edit is tapped
const editingNotes = ref(!initial?.body);

async function finishEditingNotes() {
  await save();
  editingNotes.value = false;
}

async function toggleItem(index: number) {
  draft.value.body = toggleChecklistItem(draft.value.body, index);
  await save();
}

const isImage = (name: string) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);

async function addFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  try {
    for (const file of Array.from(input.files ?? [])) await app.addAttachment(props.id, file);
  } catch (err) {
    fail(err);
  }
  input.value = '';
}

async function removeAttachment(name: string) {
  try {
    await app.removeAttachment(props.id, name);
  } catch (err) {
    fail(err);
  }
}
</script>

<template>
  <BottomSheet v-if="task" :title="t('task.heading')" full @close="close">
    <template #actions>
      <button
        class="rounded-full p-2 text-danger active:bg-line"
        :aria-label="t('common.delete')"
        data-testid="task-delete"
        @click="remove"
      >
        <Trash2 class="h-5 w-5" />
      </button>
    </template>

    <div class="space-y-4 pb-6">
      <textarea
        v-model="draft.title"
        rows="2"
        class="w-full resize-none rounded-xl border border-line bg-surface px-3 py-3 text-lg font-medium outline-none focus:border-accent"
        data-testid="task-title"
        @change="saveSoon"
      ></textarea>

      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-muted">{{ t('task.bucket') }}</span>
          <select v-model="draft.bucket" :class="field" data-testid="task-bucket" @change="saveSoon">
            <option v-for="b in app.buckets" :key="b.name" :value="b.name">{{ b.title }}</option>
            <option v-if="!app.buckets.some((b) => b.name === draft.bucket)" :value="draft.bucket">{{ draft.bucket }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-muted">{{ t('task.priority') }}</span>
          <select v-model="draft.priority" :class="field" data-testid="task-priority" @change="saveSoon">
            <option value="">{{ t('priority.none') }}</option>
            <option v-for="p in priorities" :key="p" :value="p">{{ t(`priority.${p}` as MessageKey) }}</option>
          </select>
        </label>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('task.due') }}</span>
        <input v-model="draft.due" type="date" :class="field" data-testid="task-due" @change="saveSoon" />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('task.tags') }}</span>
        <input
          v-model="draft.tags"
          :placeholder="t('task.tagsHint')"
          :class="field"
          autocapitalize="off"
          data-testid="task-tags"
          @change="saveSoon"
        />
      </label>

      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-medium text-muted">{{ t('task.notes') }}</span>
          <button
            v-if="draft.body && !editingNotes"
            class="inline-flex items-center gap-1 text-sm font-medium text-accent"
            data-testid="notes-edit"
            @click="editingNotes = true"
          >
            <Pencil class="h-3.5 w-3.5" />{{ t('common.edit') }}
          </button>
          <button v-else-if="draft.body" class="text-sm font-medium text-accent" data-testid="notes-done" @click="finishEditingNotes">
            {{ t('common.done') }}
          </button>
        </div>
        <MarkdownView
          v-if="draft.body && !editingNotes"
          :source="draft.body"
          class="rounded-xl border border-line bg-surface p-3"
          @toggle="toggleItem"
        />
        <textarea
          v-else
          v-model="draft.body"
          rows="8"
          :aria-label="t('task.notes')"
          :class="`${field} font-mono text-sm`"
          data-testid="task-body"
          @change="saveSoon"
        ></textarea>
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-medium text-muted">{{ t('task.attachments') }}</span>
          <label class="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-accent">
            <Paperclip class="h-4 w-4" />{{ t('task.addAttachment') }}
            <input type="file" multiple class="hidden" data-testid="task-attach" @change="addFiles" />
          </label>
        </div>
        <ul class="space-y-2">
          <li
            v-for="name in task.attachments"
            :key="name"
            class="flex items-center gap-3 rounded-xl border border-line p-2"
            data-testid="attachment-row"
          >
            <img v-if="isImage(name)" :src="app.attachmentUrl(id, name)" :alt="name" class="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <a :href="app.attachmentUrl(id, name)" target="_blank" rel="noopener" class="min-w-0 flex-1 truncate text-sm text-accent">{{
              name
            }}</a>
            <button
              class="rounded-full p-2 text-muted active:bg-line"
              :aria-label="t('task.removeAttachment')"
              @click="removeAttachment(name)"
            >
              <X class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </BottomSheet>
</template>
