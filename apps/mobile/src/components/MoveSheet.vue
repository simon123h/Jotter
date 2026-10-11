<script setup lang="ts">
import { Check } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { isPostponed } from '@/dates';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';

const props = defineProps<{ ids: string[] }>();
const app = useAppStore();
const ui = useUiStore();
const actions = useTaskActions();

/** Every task is in that bucket already, so there is nothing to move. A postponed task is not: moving it brings it back. */
const allIn = (bucket: string) =>
  props.ids.every((id) => {
    const task = app.taskById(id);
    return task?.bucket === bucket && !isPostponed(task);
  });

async function pick(bucket: string) {
  ui.close();
  await actions.moveTo(props.ids, bucket);
}
</script>

<template>
  <BottomSheet :title="props.ids.length > 1 ? `${t('move.title')} · ${props.ids.length}` : t('move.title')" @close="ui.close()">
    <ul class="-mx-4 pb-2" data-testid="move-list">
      <li v-for="b in app.buckets" :key="b.name">
        <button
          class="flex h-14 w-full items-center gap-3 px-6 text-left text-base active:bg-line disabled:opacity-60"
          :disabled="allIn(b.name)"
          :data-testid="`move-to-${b.name}`"
          @click="pick(b.name)"
        >
          <span class="min-w-0 flex-1 truncate">{{ b.title }}</span>
          <span v-if="allIn(b.name)" class="inline-flex items-center gap-1 text-sm text-accent"
            ><Check class="h-4 w-4" />{{ t('move.current') }}</span
          >
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
