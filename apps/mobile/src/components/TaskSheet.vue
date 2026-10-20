<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue';
import {
  ArrowLeft,
  EllipsisVertical,
  Trash2,
  Paperclip,
  Pencil,
  X,
  Slash,
  Check,
  Archive,
  Plus,
  Columns3,
  Flag,
  CalendarDays,
  Clock,
  Repeat,
  Bell,
  Tag,
  Palette,
} from '@lucide/vue';
import MarkdownView from './MarkdownView.vue';
import FieldRow from './FieldRow.vue';
import { appendChecklistItem, toggleChecklistItem } from '@jotter/checklist';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';
import { TASK_COLORS, colorHex } from '@/taskColors';
import { PLANNED_PRESETS, plannedFor, plannedLabel } from '@/planned';
import { REPEAT_UNITS, repeatLabel } from '@/repeat';
import { dueInfo, stampDay } from '@/dates';
import { ensureReminderPermission } from '@/reminders';
import { isoDay, parseTags } from '@jotter/task-filter';
import type { RepeatRule } from '@jotter/vault-format';
import TitleHints from './TitleHints.vue';
import { useSmartTitle } from '@/composables/useSmartTitle';

const props = defineProps<{ id: string }>();
const app = useAppStore();
const ui = useUiStore();

const task = computed(() => app.taskById(props.id));
const actions = useTaskActions();
const priorities = ['low', 'medium', 'high', 'urgent'] as const;
/** A field's label: the icon of the task card says the same thing there. */
const label = 'mb-1 flex items-center gap-1.5 text-xs font-medium text-muted';
const heading = 'mb-3 text-xs font-semibold uppercase tracking-wider text-muted';
/** The ring of the circle follows the priority, as on the task rows. */
const RING: Record<string, string> = { urgent: '#dc2626', high: '#f97316', medium: '#3b82f6', low: '#94a3b8' };
const ring = computed(() => RING[draft.value.priority] ?? 'var(--color-muted)');
// Fields have no outline of their own: the lines of a section are separated by hairlines, only the text areas keep a light surface
const field = 'w-full rounded-xl bg-surface px-3 py-3 text-base outline-none';

// The sheet edits a draft; it is written back on every change and once more when the sheet closes
const initial = task.value;
const draft = ref({
  title: initial?.title ?? '',
  bucket: initial?.bucket ?? '',
  priority: initial?.priority ?? '',
  due: initial?.due_date ?? '',
  planned: initial?.planned_date ?? '',
  repeatKind: initial?.repeat ? (initial.repeat.every === 1 ? initial.repeat.unit : 'custom') : '',
  repeatUnit: initial?.repeat?.unit ?? '',
  repeatEvery: initial?.repeat?.every ?? 1,
  repeatFrom: initial?.repeat?.from ?? 'completion',
  reminders: [...(initial?.reminders ?? [])],
  color: initial?.color ?? '',
  tags: (initial?.tags ?? []).join(', '),
  body: initial?.body ?? '',
});

// What the title says (a date, p1, #tag, /column) is read while it is typed and applied when the field is left
const smart = useSmartTitle(
  computed(() => draft.value.title),
  () => app.buckets
);
const titleEdited = ref(false);

function commitTitle() {
  const found = smart.resolve();
  if (titleEdited.value && found.found && found.title) {
    const d = draft.value;
    d.title = found.title;
    if (found.bucket) d.bucket = found.bucket;
    if (found.priority) d.priority = found.priority;
    if (found.due_date !== null || found.planned_date !== null) {
      d.due = found.due_date ?? '';
      d.planned = found.planned_date ?? '';
    }
    if (found.tags.length) d.tags = [...new Set([...parseTags(d.tags), ...found.tags])].join(', ');
  }
  titleEdited.value = false;
  smart.reset();
  saveSoon();
}

/** What a row says about its value; the control itself is invisible. */
const dayText = (iso: string) => (iso ? dueInfo(iso).text : '');
const bucketTitle = computed(() => app.buckets.find((b) => b.name === draft.value.bucket)?.title ?? draft.value.bucket);
const priorityText = computed(() => t(`priority.${draft.value.priority || 'none'}` as MessageKey));
const repeatText = computed(() => {
  const rule = repeatOf(draft.value);
  return rule ? repeatLabel(rule) : t('repeat.never');
});
/** When the task was made and last changed: one quiet line at the end of the page. */
const stamps = computed(() => {
  const created = task.value ? stampDay(task.value.created_at) : null;
  const updated = task.value ? stampDay(task.value.updated_at) : null;
  return created && updated ? t('task.stamps', { created, updated }) : '';
});
const clearLabel = (name: MessageKey) => t('task.clearField', { field: t(name) });

function clearDay() {
  draft.value.due = '';
  saveSoon();
}

/** The planned menu: the weeks and months as they are today, and a day to pick. A value from elsewhere stays selectable. */
const plannedOptions = computed(() => PLANNED_PRESETS.map((p) => plannedFor(p)));
const pickingDay = ref(false);
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const plannedChoice = computed({
  get: () => (pickingDay.value ? '__day' : draft.value.planned),
  set: (value: string) => {
    pickingDay.value = value === '__day';
    if (!pickingDay.value) {
      draft.value.planned = value;
      saveSoon();
    }
  },
});
/** The day field shows while a day is being picked, or when the task is planned for a day the menu does not offer. */
const showPlannedDay = computed(
  () => pickingDay.value || (isDay(draft.value.planned) && !plannedOptions.value.includes(draft.value.planned))
);
const plannedDay = computed({
  get: () => (isDay(draft.value.planned) ? draft.value.planned : ''),
  set: (value: string) => {
    pickingDay.value = false;
    draft.value.planned = value;
    saveSoon();
  },
});
function clearPlanned() {
  pickingDay.value = false;
  draft.value.planned = '';
  saveSoon();
}

function clearRepeat() {
  draft.value.repeatKind = '';
  pickRepeat();
}

const menuOpen = ref(false);
const menuItem = 'flex h-12 w-full items-center gap-3 px-4 text-left text-base active:bg-line';

const fail = (err: unknown) => ui.showToast(err instanceof Error ? err.message : String(err));
let closing = false;

/** The rule the repeat fields describe, none when no unit is chosen or the number is not a whole number above zero. */
function repeatOf(d: typeof draft.value): RepeatRule | undefined {
  const every = Number(d.repeatEvery);
  if (!d.repeatUnit || !Number.isInteger(every) || every < 1) return undefined;
  return { every, unit: d.repeatUnit as RepeatRule['unit'], from: d.repeatFrom as RepeatRule['from'] };
}

/** A preset (daily, weekly, ...) is every one unit; Custom opens the number and the unit. */
function pickRepeat() {
  const d = draft.value;
  if (d.repeatKind === 'custom') {
    d.repeatUnit = d.repeatUnit || 'week';
    d.repeatEvery = d.repeatEvery > 1 ? d.repeatEvery : 2;
  } else {
    d.repeatUnit = d.repeatKind;
    d.repeatEvery = 1;
  }
  saveSoon();
}

async function addReminder() {
  // Asked when the first reminder is added, not when the app starts
  if (!(await ensureReminderPermission())) ui.showToast(t('reminders.denied'));
  // The day it is due, or tomorrow, at nine
  draft.value.reminders.push(`${draft.value.due || isoDay(1)}T09:00`);
  saveSoon();
}

function removeReminder(index: number) {
  draft.value.reminders.splice(index, 1);
  saveSoon();
}

async function save() {
  const current = task.value;
  if (!current || closing) return;
  const d = draft.value;
  const tags = parseTags(d.tags);
  const changes: Parameters<typeof app.saveTask>[1] = {};
  if (d.title.trim() && d.title.trim() !== current.title) changes.title = d.title.trim();
  if ((d.priority || undefined) !== current.priority) changes.priority = d.priority || undefined;
  if ((d.due || undefined) !== current.due_date) changes.due_date = d.due || undefined;
  if ((d.planned || undefined) !== current.planned_date) changes.planned_date = d.planned || undefined;
  const repeat = repeatOf(d);
  if (JSON.stringify(repeat ?? null) !== JSON.stringify(current.repeat ?? null)) changes.repeat = repeat;
  const reminders = [...new Set(d.reminders.filter(Boolean))].sort();
  if (reminders.join(',') !== (current.reminders ?? []).join(',')) changes.reminders = reminders;
  if ((d.color || null) !== (current.color ?? null)) changes.color = d.color || null;
  if (tags.join(',') !== current.tags.join(',')) changes.tags = tags;
  if (d.body !== current.body) changes.body = d.body;
  try {
    if (Object.keys(changes).length) await app.saveTask(props.id, changes);
    if (d.bucket && d.bucket !== current.bucket) await app.moveTask(props.id, d.bucket);
  } catch (err) {
    fail(err);
  }
}

function pickColor(id: string) {
  draft.value.color = id;
  void save();
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

/** Saves what is typed first, then moves the task: the sheet must not write its old bucket back afterwards. */
async function finish(kind: 'done' | 'reopen' | 'archive') {
  await save();
  closing = true;
  ui.close();
  await actions[kind === 'done' ? 'markDone' : kind === 'reopen' ? 'reopen' : 'archive'](props.id);
}

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

const newItem = ref('');

async function addItem() {
  if (!newItem.value.trim()) return;
  draft.value.body = appendChecklistItem(draft.value.body, newItem.value);
  newItem.value = '';
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
  <!-- A page of its own, not a sheet: the arrow leaves it (everything is saved as it is edited), the circle beside the title finishes the task, the menu archives or deletes it -->
  <div
    v-if="task"
    class="fixed inset-0 z-40 flex flex-col bg-card"
    style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)"
    role="dialog"
    aria-modal="true"
    :aria-label="t('task.heading')"
    data-testid="task-page"
  >
    <header class="relative flex h-14 shrink-0 items-center gap-1 border-b border-line px-1">
      <button
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:bg-line"
        :aria-label="t('common.back')"
        data-testid="task-back"
        @click="close"
      >
        <ArrowLeft class="h-6 w-6" />
      </button>
      <h2 class="min-w-0 flex-1 truncate px-2 text-[1.35rem] font-normal leading-7">{{ t('task.heading') }}</h2>
      <button
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:bg-line"
        :aria-label="t('common.moreActions')"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        data-testid="task-menu"
        @click="menuOpen = !menuOpen"
      >
        <EllipsisVertical class="h-6 w-6" />
      </button>

      <template v-if="menuOpen">
        <div class="fixed inset-0 z-10" data-testid="task-menu-scrim" @click="menuOpen = false"></div>
        <div
          class="absolute right-2 top-12 z-20 w-56 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-xl"
          role="menu"
          data-testid="task-menu-list"
        >
          <!-- Also the circle beside the title; here for whoever looks in the menu -->
          <button
            v-if="task.bucket !== 'archive'"
            :class="menuItem"
            role="menuitem"
            data-testid="task-done"
            @click="finish(task.bucket === 'done' ? 'reopen' : 'done')"
          >
            <Check class="h-5 w-5 text-muted" />{{ t(task.bucket === 'done' ? 'task.reopen' : 'task.markDone') }}
          </button>
          <button v-if="task.bucket !== 'archive'" :class="menuItem" role="menuitem" data-testid="task-archive" @click="finish('archive')">
            <Archive class="h-5 w-5 text-muted" />{{ t('task.archive') }}
          </button>
          <button :class="`${menuItem} text-danger`" role="menuitem" data-testid="task-delete" @click="remove">
            <Trash2 class="h-5 w-5" />{{ t('common.delete') }}
          </button>
        </div>
      </template>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
      <div class="space-y-4 pb-6">
        <div class="flex items-start gap-1">
          <!-- The same circle as on the task rows: it finishes the task, or takes a finished one back to the inbox -->
          <button
            v-if="task.bucket !== 'archive'"
            type="button"
            class="-ml-1 flex h-12 w-12 shrink-0 items-center justify-center"
            role="checkbox"
            :aria-checked="task.bucket === 'done'"
            :aria-label="t(task.bucket === 'done' ? 'swipe.reopen' : 'swipe.done')"
            data-testid="task-check"
            @click="finish(task.bucket === 'done' ? 'reopen' : 'done')"
          >
            <span
              class="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-colors"
              :style="{
                borderColor: ring,
                backgroundColor: task.bucket === 'done' ? ring : `color-mix(in srgb, ${ring} 12%, transparent)`,
              }"
            >
              <Check v-if="task.bucket === 'done'" class="h-4 w-4 text-accent-ink" :stroke-width="3" />
            </span>
          </button>
          <textarea
            v-model="draft.title"
            rows="1"
            :aria-label="t('task.title')"
            class="field-sizing-content block min-w-0 flex-1 resize-none bg-transparent px-1 py-3 text-xl font-semibold leading-snug outline-none"
            :class="task.bucket === 'done' ? 'text-muted line-through' : ''"
            data-testid="task-title"
            @input="titleEdited = true"
            @beforeinput="titleEdited && smart.onBeforeInput($event)"
            @change="commitTitle"
          ></textarea>
        </div>
        <TitleHints v-if="titleEdited" :hints="smart.hints.value" class="-mt-2" @ignore="smart.ignore" />

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
          <MarkdownView v-if="draft.body && !editingNotes" :source="draft.body" class="rounded-xl bg-surface p-3" @toggle="toggleItem" />
          <textarea
            v-else
            v-model="draft.body"
            rows="3"
            :aria-label="t('task.notes')"
            :class="`${field} field-sizing-content min-h-24 font-mono text-sm`"
            data-testid="task-body"
            @change="saveSoon"
          ></textarea>
          <!-- The last line of the list: a plus and a field without an outline; Enter adds, the button shows once something is typed -->
          <form class="mt-1 flex items-center gap-2 px-1" @submit.prevent="addItem">
            <Plus class="h-5 w-5 shrink-0 text-muted" />
            <input
              v-model="newItem"
              :placeholder="t('task.addItem')"
              :aria-label="t('task.addItem')"
              class="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted"
              enterkeyhint="done"
              data-testid="checklist-add-input"
            />
            <button v-if="newItem.trim()" type="submit" class="px-2 py-3 text-sm font-medium text-accent" data-testid="checklist-add">
              {{ t('task.add') }}
            </button>
          </form>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted">{{ t('task.attachments') }}</span>
            <label class="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-accent">
              <Paperclip class="h-4 w-4" />{{ t('task.addAttachment') }}
              <input type="file" multiple class="hidden" data-testid="task-attach" @change="addFiles" />
            </label>
          </div>
          <ul v-if="task.attachments.length" class="mt-2 space-y-2">
            <li
              v-for="name in task.attachments"
              :key="name"
              class="flex items-center gap-3 rounded-xl bg-surface p-2"
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

        <!-- What the task is about, with the notes; the lines below say where it stands -->
        <label class="flex min-h-12 items-center gap-3 border-t border-line px-1">
          <Tag class="h-5 w-5 shrink-0 text-muted" />
          <span class="shrink-0 text-base">{{ t('task.tags') }}</span>
          <input
            v-model="draft.tags"
            :placeholder="t('task.tagsHint')"
            class="min-w-0 flex-1 bg-transparent py-3 text-right text-base outline-none placeholder:text-muted"
            autocapitalize="off"
            data-testid="task-tags"
            @change="saveSoon"
          />
        </label>

        <!-- The fields come last: opening a task is mostly about reading and ticking its notes. Each is a line that says what it is set to. -->
        <div class="space-y-6 border-t border-line pt-4">
          <section data-testid="group-status">
            <h3 :class="heading">{{ t('task.groupStatus') }}</h3>
            <div class="divide-y divide-line">
              <FieldRow :icon="Columns3" :label="t('task.bucket')" :value="bucketTitle">
                <select v-model="draft.bucket" :aria-label="t('task.bucket')" data-testid="task-bucket" @change="saveSoon">
                  <option v-for="b in app.buckets" :key="b.name" :value="b.name">{{ b.title }}</option>
                  <option v-if="!app.buckets.some((b) => b.name === draft.bucket)" :value="draft.bucket">{{ draft.bucket }}</option>
                </select>
              </FieldRow>
              <FieldRow :icon="Flag" :icon-color="draft.priority ? ring : undefined" :label="t('task.priority')" :value="priorityText">
                <select v-model="draft.priority" :aria-label="t('task.priority')" data-testid="task-priority" @change="saveSoon">
                  <option value="">{{ t('priority.none') }}</option>
                  <option v-for="p in priorities" :key="p" :value="p">{{ t(`priority.${p}` as MessageKey) }}</option>
                </select>
              </FieldRow>
            </div>
          </section>

          <section data-testid="group-time">
            <h3 :class="heading">{{ t('task.groupTime') }}</h3>
            <div class="divide-y divide-line">
              <FieldRow
                :icon="CalendarDays"
                :label="t('task.due')"
                :value="dayText(draft.due)"
                :clear-label="clearLabel('task.due')"
                clear-testid="task-due-clear"
                @clear="clearDay"
              >
                <input v-model="draft.due" type="date" :aria-label="t('task.due')" data-testid="task-due" @change="saveSoon" />
              </FieldRow>

              <FieldRow
                :icon="Clock"
                :label="t('task.planned')"
                :value="draft.planned ? plannedLabel(draft.planned) : t('planned.none')"
                :clear-label="draft.planned ? clearLabel('task.planned') : undefined"
                clear-testid="task-planned-clear"
                @clear="clearPlanned"
              >
                <select v-model="plannedChoice" :aria-label="t('task.planned')" data-testid="task-planned">
                  <option value="">{{ t('planned.none') }}</option>
                  <option v-for="value in plannedOptions" :key="value" :value="value">{{ plannedLabel(value) }}</option>
                  <option value="__day">{{ t('planned.pickDay') }}</option>
                  <!-- A value from elsewhere (a week or month that is not the current one, a day) stays selectable and is kept -->
                  <option v-if="draft.planned && !pickingDay && !plannedOptions.includes(draft.planned)" :value="draft.planned">
                    {{ plannedLabel(draft.planned) }}
                  </option>
                </select>
              </FieldRow>
              <FieldRow v-if="showPlannedDay" :icon="CalendarDays" :label="t('task.plannedDay')" :value="dayText(plannedDay)">
                <input v-model="plannedDay" type="date" :aria-label="t('task.plannedDay')" data-testid="task-planned-day" />
              </FieldRow>

              <FieldRow
                :icon="Repeat"
                :label="t('task.repeat')"
                :value="repeatText"
                :clear-label="draft.repeatKind ? clearLabel('task.repeat') : undefined"
                @clear="clearRepeat"
              >
                <select v-model="draft.repeatKind" :aria-label="t('task.repeat')" data-testid="task-repeat" @change="pickRepeat">
                  <option value="">{{ t('repeat.never') }}</option>
                  <option v-for="u in REPEAT_UNITS" :key="u" :value="u">{{ t(`repeat.once.${u}` as MessageKey) }}</option>
                  <option value="custom">{{ t('repeat.custom') }}</option>
                </select>
              </FieldRow>
              <div v-if="draft.repeatKind === 'custom'" class="flex items-center gap-3 py-2 pl-9">
                <span class="text-sm text-muted">{{ t('repeat.every') }}</span>
                <input
                  v-model.number="draft.repeatEvery"
                  type="number"
                  min="1"
                  inputmode="numeric"
                  :aria-label="t('repeat.every')"
                  :class="`${field} w-24`"
                  data-testid="task-repeat-every"
                  @change="saveSoon"
                />
                <select
                  v-model="draft.repeatUnit"
                  :aria-label="t('task.repeat')"
                  :class="`${field} min-w-0 flex-1`"
                  data-testid="task-repeat-unit"
                  @change="saveSoon"
                >
                  <option v-for="u in REPEAT_UNITS" :key="u" :value="u">{{ t(`repeat.unit.${u}` as MessageKey) }}</option>
                </select>
              </div>
              <FieldRow
                v-if="draft.repeatKind"
                :label="t('repeat.counted')"
                :value="draft.repeatFrom === 'due' ? t('repeat.fromDue') : t('repeat.fromCompletion')"
              >
                <select v-model="draft.repeatFrom" :aria-label="t('repeat.counted')" data-testid="task-repeat-from" @change="saveSoon">
                  <option value="completion">{{ t('repeat.fromCompletion') }}</option>
                  <option value="due">{{ t('repeat.fromDue') }}</option>
                </select>
              </FieldRow>

              <div class="flex min-h-12 items-center gap-3 px-1">
                <Bell class="h-5 w-5 shrink-0 text-muted" />
                <span class="flex-1 text-base">{{ t('task.reminders') }}</span>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 py-3 text-sm font-medium text-accent"
                  data-testid="reminder-add"
                  @click="addReminder"
                >
                  <Plus class="h-4 w-4" />{{ t('task.addReminder') }}
                </button>
              </div>
              <FieldRow
                v-for="(_, i) in draft.reminders"
                :key="i"
                :label="draft.reminders[i]?.replace('T', ' ') ?? ''"
                :clear-label="t('task.removeReminder')"
                clear-testid="reminder-remove"
                @clear="removeReminder(i)"
              >
                <input
                  v-model="draft.reminders[i]"
                  type="datetime-local"
                  :aria-label="t('task.reminders')"
                  data-testid="reminder-input"
                  @change="saveSoon"
                />
              </FieldRow>
            </div>
          </section>

          <!-- Rarely changed: the last thing on the page -->
          <div class="px-1">
            <span :class="`${label} mb-3`"
              ><Palette class="h-5 w-5 shrink-0" /><span class="text-base font-normal text-current">{{ t('task.color') }}</span></span
            >
            <div class="flex flex-wrap items-center gap-2.5" role="radiogroup" :aria-label="t('task.color')" data-testid="task-colors">
              <button
                type="button"
                role="radio"
                :aria-checked="!draft.color"
                :aria-label="t('color.none')"
                class="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted"
                :class="!draft.color ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''"
                data-testid="color-none"
                @click="pickColor('')"
              >
                <Slash class="h-4 w-4 rotate-90" />
              </button>
              <button
                v-for="c in TASK_COLORS"
                :key="c.id"
                type="button"
                role="radio"
                :aria-checked="draft.color === c.id"
                :aria-label="t(`color.${c.id}` as MessageKey)"
                class="flex h-8 w-8 items-center justify-center rounded-full text-white"
                :class="draft.color === c.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''"
                :style="{ backgroundColor: c.hex }"
                :data-testid="`color-${c.id}`"
                @click="pickColor(c.id)"
              >
                <Check v-if="draft.color === c.id" class="h-4 w-4" />
              </button>
              <!-- A colour written by another tool, outside the palette, stays as it is -->
              <span
                v-if="draft.color && !TASK_COLORS.some((c) => c.id === draft.color) && colorHex(draft.color)"
                class="h-8 w-8 rounded-full ring-2 ring-accent ring-offset-2 ring-offset-card"
                :style="{ backgroundColor: colorHex(draft.color) }"
                data-testid="color-custom"
              ></span>
            </div>
          </div>

          <p v-if="stamps" class="px-1 text-xs text-muted" data-testid="task-stamps">{{ stamps }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
