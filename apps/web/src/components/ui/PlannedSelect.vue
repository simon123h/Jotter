<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { plannedChoices, plannedLabel } from '@/utils/planned';

/**
 * The planned date of a task: today, tomorrow, a week or a month, or a day of its own choosing. The value is what goes into
 * the file: a day, an ISO week (`2026-W43`) or a month (`2026-10`), empty when not planned.
 */
const model = defineModel<string>({ default: '' });
const { t, locale } = useI18n();

const choices = computed(() => plannedChoices());
const offered = computed(() => choices.value.some((c) => c.value === model.value));
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const picking = ref(false);
const choice = computed({
  get: () => (picking.value ? '__day' : model.value),
  set: (value: string) => {
    picking.value = value === '__day';
    if (!picking.value) model.value = value;
  },
});
/** The day field shows while a day is being picked, or when the task is planned for a day the menu does not offer. */
const showDay = computed(() => picking.value || (isDay(model.value) && !offered.value));
const day = computed({
  get: () => (isDay(model.value) ? model.value : ''),
  set: (value: string) => {
    picking.value = false;
    model.value = value;
  },
});

const field =
  'w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring';
</script>

<template>
  <div class="flex gap-1.5">
    <select v-model="choice" :class="[field, 'min-w-0 flex-1']" data-testid="planned-select">
      <option value="">{{ t('plannedDateOptions.none') }}</option>
      <option v-for="c in choices" :key="c.value" :value="c.value">{{ t('plannedDateOptions.' + c.preset) }}</option>
      <option value="__day">{{ t('plannedDateOptions.pickDay') }}</option>
      <!-- A value from elsewhere (a week or a month that is not the current one) stays selectable and is kept -->
      <option v-if="model && !picking && !offered" :value="model">{{ plannedLabel(model, t, locale) }}</option>
    </select>
    <input v-if="showDay" v-model="day" type="date" :class="[field, 'min-w-0 flex-1']" data-testid="planned-day" />
  </div>
</template>
