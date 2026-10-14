<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Check, ChevronDown } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import type { Column } from '@/stores/app';
import TitleHints from './TitleHints.vue';
import { duplicateOf } from '@jotter/links';
import { useSmartTitle, type Hint } from '@/composables/useSmartTitle';

/** The tab in view: a new task is filed where the user is looking (its column, tag or planned date), unless the sheet was opened for the inbox. */
const props = defineProps<{ column: Column | null }>();
const app = useAppStore();
const ui = useUiStore();

// Text shared from another app arrives as a draft: the title to edit and the notes it brings along
const draft = ui.sheet?.type === 'quickadd' ? ui.sheet.draft : undefined;
const title = ref(draft?.title ?? '');
let draftBody = draft?.body;
const input = ref<HTMLInputElement | null>(null);
/** Opened from outside (launcher shortcut, shared text): nothing is in view, so the task goes to the project's default column. */
const inbox = ui.sheet?.type === 'quickadd' && !!ui.sheet.inbox;
/** A column chosen in the sheet. It replaces what is in view, tag and planned date included. */
const picked = ref<string | null>(null);
const here = computed(() => (inbox || picked.value !== null ? null : props.column));
/** The column the task goes to: the one chosen, the one in view, or the project's default. */
const bucket = computed(
  () => app.buckets.find((b) => b.name === (picked.value ?? here.value?.bucket)) ?? app.buckets.find((b) => b.is_default) ?? app.buckets[0]
);
/** Where the task goes, as the chip says it: the project, then the column, tag or planned date. */
const destination = computed(
  () => `${app.project?.title ?? ''} · ${here.value?.value !== undefined ? here.value.title : (bucket.value?.title ?? '')}`
);
const choosing = ref(false);

async function chooseProject(id: string) {
  if (id !== app.projectId) await app.selectProject(id);
  picked.value = (app.buckets.find((b) => b.is_default) ?? app.buckets[0])?.name ?? null;
}

const smart = useSmartTitle(title, () => app.buckets);
/** What is left of the title once dates, priority, tags and column are taken out. */
const finalTitle = computed(() => smart.resolve().title);
const busy = ref(false);
/** A task of this project that already holds the address being typed or pasted. */
const duplicate = computed(() => duplicateOf(`${title.value}\n${draftBody ?? ''}`, app.allTasks));
// What was added in this sheet, so the next capture can follow without leaving
const added = ref<string[]>([]);

onMounted(() => input.value?.focus());

/**
 * The chips slide open and shut instead of making the sheet jump. They stay drawn while they close, so the row
 * does not empty before it has shrunk.
 */
const shownHints = ref<Hint[]>([]);
let clearTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => smart.hints.value,
  (hints) => {
    clearTimeout(clearTimer);
    if (hints.length) shownHints.value = hints;
    else clearTimer = setTimeout(() => (shownHints.value = []), 220);
  },
  { immediate: true }
);
onBeforeUnmount(() => clearTimeout(clearTimer));

async function submit() {
  const found = smart.resolve();
  const clean = found.title;
  if (!clean || busy.value) return;
  busy.value = true;
  try {
    const column = here.value;
    // Where the user is looking sets the defaults; what the title says wins
    const viewTag = app.view === 'tags' && column?.value ? [column.value] : [];
    const viewPlanned = app.view === 'planning' && column?.value ? column.value : undefined;
    await app.addTask({
      title: clean,
      bucket: found.bucket ?? picked.value ?? column?.bucket ?? undefined,
      tags: [...new Set([...viewTag, ...found.tags])],
      due_date: found.due_date ?? undefined,
      planned_date: found.planned_date ?? viewPlanned,
      priority: found.priority ?? undefined,
      body: draftBody,
    });
    draftBody = undefined;
    title.value = '';
    smart.reset();
    added.value.unshift(clean);
    // Stay open for the next one: quick capture is the point of this sheet
    input.value?.focus();
  } catch (err) {
    ui.showToast(err instanceof Error ? err.message : String(err));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BottomSheet :title="t('task.new')" @close="ui.close()">
    <!-- Above the field: the sheet grows upwards, so the field stays where the thumb is -->
    <div
      class="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
      :class="smart.hints.value.length ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
      :inert="smart.hints.value.length ? undefined : true"
      data-testid="title-hints-slot"
    >
      <div class="min-h-0 overflow-hidden">
        <TitleHints :hints="shownHints" class="pb-3" @ignore="smart.ignore" />
      </div>
    </div>
    <!-- Where the task goes. Tapping it offers another project or column; the choice holds for the next task. -->
    <button
      type="button"
      class="mb-2 flex max-w-full items-center gap-1 rounded-full bg-line px-3 py-1.5 text-sm text-muted active:opacity-70"
      :aria-label="t('quickAdd.where')"
      :aria-expanded="choosing"
      data-testid="quick-add-destination"
      @pointerdown.prevent
      @click="choosing = !choosing"
    >
      <span class="truncate">{{ destination }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 transition-transform" :class="choosing ? 'rotate-180' : ''" />
    </button>
    <div v-if="choosing" class="mb-3 space-y-2" data-testid="quick-add-choices">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('quickAdd.project')">
        <button
          v-for="p in app.orderedProjects"
          :key="p.id"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="p.id === app.projectId ? 'border-accent bg-accent/15 text-accent' : 'border-line'"
          :data-testid="`quick-add-project-${p.id}`"
          @pointerdown.prevent
          @click="chooseProject(p.id)"
        >
          {{ p.title }}
        </button>
      </div>
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('quickAdd.column')">
        <button
          v-for="b in app.buckets"
          :key="b.name"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="b.name === bucket?.name && here?.bucket !== null ? 'border-accent bg-accent/15 text-accent' : 'border-line'"
          :data-testid="`quick-add-column-${b.name}`"
          @pointerdown.prevent
          @click="picked = b.name"
        >
          {{ b.title }}
        </button>
      </div>
    </div>
    <p v-if="duplicate" class="pb-2 text-sm text-amber-600" data-testid="quick-add-duplicate">
      {{ t('quickAdd.alreadySaved', { title: duplicate.title }) }}
    </p>
    <form class="flex gap-2 pb-2" @submit.prevent="submit">
      <input
        ref="input"
        v-model="title"
        :placeholder="t('task.titlePlaceholder')"
        class="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        enterkeyhint="send"
        data-testid="quick-add-input"
        @beforeinput="smart.onBeforeInput"
        @keydown.enter.prevent="submit"
      />
      <button
        type="submit"
        class="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
        :disabled="!finalTitle || busy"
        @pointerdown.prevent
        data-testid="quick-add-submit"
      >
        {{ t('task.add') }}
      </button>
    </form>
    <ul v-if="added.length" class="space-y-1 pb-2" data-testid="quick-add-added">
      <li v-for="(item, i) in added" :key="i" class="flex items-center gap-2 text-sm text-muted">
        <Check class="h-4 w-4 shrink-0 text-accent" /><span class="truncate">{{ item }}</span>
      </li>
    </ul>
  </BottomSheet>
</template>
