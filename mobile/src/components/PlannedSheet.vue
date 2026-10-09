<script setup lang="ts">
import { computed } from 'vue';
import { Check, Clock } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { PLANNED_CHOICES, plannedLabel } from '@/planned';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';

const props = defineProps<{ ids: string[] }>();
const app = useAppStore();
const ui = useUiStore();
const actions = useTaskActions();

/** The planned date every selected task has, when they agree. */
const shared = computed(() => {
  const values = new Set(props.ids.map((id) => app.taskById(id)?.planned_date ?? ''));
  return values.size === 1 ? [...values][0] : null;
});

async function pick(planned: string) {
  ui.close();
  await actions.setPlanned(props.ids, planned);
}
</script>

<template>
  <BottomSheet :title="`${t('bulk.setPlanned')} · ${props.ids.length}`" @close="ui.close()">
    <ul class="-mx-4 pb-2" data-testid="planned-list">
      <li v-for="choice in ['', ...PLANNED_CHOICES]" :key="choice">
        <button
          class="flex h-14 w-full items-center gap-4 px-6 text-left text-base active:bg-line"
          :data-testid="`planned-${choice || 'none'}`"
          @click="pick(choice)"
        >
          <Clock class="h-5 w-5 shrink-0 text-muted" />
          <span class="min-w-0 flex-1">{{ choice ? plannedLabel(choice) : t('planned.none') }}</span>
          <Check v-if="shared === choice" class="h-5 w-5 text-accent" />
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
