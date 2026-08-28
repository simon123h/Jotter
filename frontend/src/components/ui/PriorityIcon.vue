<script setup lang="ts">
import { computed } from 'vue';
import { Flame, ChevronUp, Equal, ChevronDown } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    priority?: string | null;
    showLabel?: boolean;
    compact?: boolean;
    size?: 'xs' | 'sm' | 'md';
  }>(),
  {
    priority: 'none',
    showLabel: false,
    compact: false,
    size: 'sm',
  }
);

const normalizedPriority = computed(() => (props.priority || 'none').toLowerCase());

const config = computed(() => {
  switch (normalizedPriority.value) {
    case 'urgent':
      return {
        icon: Flame,
        label: t('priorityOptions.urgent') || 'Urgent',
        classes: 'text-red-400 bg-red-500/10 border-red-500/30',
        iconClasses: 'text-red-400 animate-pulse',
      };
    case 'high':
      return {
        icon: ChevronUp,
        label: t('priorityOptions.high') || 'High',
        classes: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
        iconClasses: 'text-orange-400 stroke-[2.5px]',
      };
    case 'medium':
      return {
        icon: Equal,
        label: t('priorityOptions.medium') || 'Medium',
        classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
        iconClasses: 'text-yellow-400 stroke-[2px]',
      };
    case 'low':
      return {
        icon: ChevronDown,
        label: t('priorityOptions.low') || 'Low',
        classes: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        iconClasses: 'text-blue-400 stroke-[2px]',
      };
    default:
      return null;
  }
});
</script>

<template>
  <span
    v-if="config"
    class="inline-flex items-center gap-1 rounded border leading-none shrink-0 transition-transform select-none"
    :class="[
      config.classes,
      compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px] font-bold',
    ]"
    :title="t('form.priority') + ': ' + config.label"
  >
    <component
      :is="config.icon"
      :class="[
        config.iconClasses,
        compact ? 'w-2.5 h-2.5' : 'w-3 h-3',
      ]"
    />
    <span v-if="showLabel" class="uppercase tracking-wider">
      {{ config.label }}
    </span>
  </span>
</template>
