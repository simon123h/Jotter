<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Check } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import type { Column } from '@/stores/app';
import TitleHints from './TitleHints.vue';
import { useSmartTitle, type Hint } from '@/composables/useSmartTitle';
import { isoDay } from '@/dates';

/** The tab in view: a new task is filed where the user is looking (its column, tag or planned date). */
const props = defineProps<{ column: Column | null }>();
const app = useAppStore();
const ui = useUiStore();

const title = ref('');
const input = ref<HTMLInputElement | null>(null);
const smart = useSmartTitle(title, () => app.buckets);
/** What is left of the title once dates, priority, tags and column are taken out. */
const finalTitle = computed(() => smart.resolve().title);
const busy = ref(false);
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
    const column = props.column;
    // Where the user is looking sets the defaults; what the title says wins
    const viewTag = app.view === 'tags' && column?.value ? [column.value] : [];
    const viewPlanned = app.view === 'planning' && column?.value ? column.value : undefined;
    // The virtual Postponed column files a task in the default column, postponed to tomorrow
    const virtual = column?.key === 'postponed' && !app.buckets.some((b) => b.name === 'postponed');
    await app.addTask({
      title: clean,
      bucket: found.bucket ?? (virtual ? undefined : (column?.bucket ?? undefined)),
      postponed_until: virtual ? isoDay(1) : undefined,
      tags: [...new Set([...viewTag, ...found.tags])],
      due_date: found.due_date ?? undefined,
      planned_date: found.planned_date ?? viewPlanned,
      priority: found.priority ?? undefined,
    });
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
