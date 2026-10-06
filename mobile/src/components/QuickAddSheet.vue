<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ bucket: string | null }>();
const app = useAppStore();
const ui = useUiStore();

const title = ref('');
const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);

onMounted(() => input.value?.focus());

async function submit() {
  const clean = title.value.trim();
  if (!clean || busy.value) return;
  busy.value = true;
  try {
    await app.addTask({ title: clean, bucket: props.bucket ?? undefined });
    title.value = '';
    ui.showToast(clean);
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
  </BottomSheet>
</template>
