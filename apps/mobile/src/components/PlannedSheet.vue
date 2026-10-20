<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Clock } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { PLANNED_PRESETS, plannedFor, plannedLabel } from '@/planned';
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

/** What the menu offers, as the day, week or month it stands for today. */
const choices = computed(() => ['', ...PLANNED_PRESETS.map((p) => plannedFor(p))]);

const day = ref('');

async function pick(planned: string) {
  ui.close();
  await actions.setPlanned(props.ids, planned);
}
</script>

<template>
  <BottomSheet :title="`${t('bulk.setPlanned')} · ${props.ids.length}`" @close="ui.close()">
    <ul class="-mx-4 pb-2" data-testid="planned-list">
      <li v-for="choice in choices" :key="choice">
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
      <li class="flex gap-2 px-6 pt-2">
        <input
          v-model="day"
          type="date"
          :aria-label="t('planned.pickDay')"
          class="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent"
          data-testid="planned-day-input"
        />
        <button
          class="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
          :disabled="!day"
          data-testid="planned-day-apply"
          @click="pick(day)"
        >
          {{ t('bulk.apply') }}
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
