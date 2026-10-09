<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Check } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import type { Column } from '@/stores/app';

/** The tab in view: a new task is filed where the user is looking (its column, tag or planned date). */
const props = defineProps<{ column: Column | null }>();
const app = useAppStore();
const ui = useUiStore();

const title = ref('');
const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);
// What was added in this sheet, so the next capture can follow without leaving
const added = ref<string[]>([]);

onMounted(() => input.value?.focus());

async function submit() {
  const clean = title.value.trim();
  if (!clean || busy.value) return;
  busy.value = true;
  try {
    const column = props.column;
    await app.addTask({
      title: clean,
      bucket: column?.bucket ?? undefined,
      tags: app.view === 'tags' && column?.value ? [column.value] : undefined,
      planned_date: app.view === 'planning' && column?.value ? column.value : undefined,
    });
    title.value = '';
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
    <form class="flex gap-2 pb-2" @submit.prevent="submit">
      <input
        ref="input"
        v-model="title"
        :placeholder="t('task.titlePlaceholder')"
        class="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        enterkeyhint="done"
        data-testid="quick-add-input"
      />
      <button
        type="submit"
        class="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
        :disabled="!title.trim() || busy"
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
