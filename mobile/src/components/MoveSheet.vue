<script setup lang="ts">
import { Check } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';

const props = defineProps<{ id: string }>();
const app = useAppStore();
const ui = useUiStore();
const actions = useTaskActions();

const task = () => app.taskById(props.id);

async function pick(bucket: string) {
  ui.close();
  await actions.moveTo(props.id, bucket);
}
</script>

<template>
  <BottomSheet :title="t('move.title')" @close="ui.close()">
    <ul class="-mx-4 pb-2" data-testid="move-list">
      <li v-for="b in app.buckets" :key="b.name">
        <button
          class="flex h-14 w-full items-center gap-3 px-6 text-left text-base active:bg-line disabled:opacity-60"
          :disabled="task()?.bucket === b.name"
          :data-testid="`move-to-${b.name}`"
          @click="pick(b.name)"
        >
          <span class="min-w-0 flex-1 truncate">{{ b.title }}</span>
          <span v-if="task()?.bucket === b.name" class="inline-flex items-center gap-1 text-sm text-accent">
            <Check class="h-4 w-4" />{{ t('move.current') }}
          </span>
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
