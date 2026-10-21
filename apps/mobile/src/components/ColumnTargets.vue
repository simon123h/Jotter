<script setup lang="ts">
import { ArrowDownToLine, Plus, Minus } from '@lucide/vue';
import type { Column } from '@/stores/columns';
import { useColumnTargets } from '@/composables/useColumnTargets';

const props = defineProps<{ column: Column; size: 'bar' | 'section' }>();

const { targetsFor } = useColumnTargets();

const classes = {
  bar: 'h-9 gap-1.5 px-3 text-sm',
  section: 'h-7 gap-1 px-2.5 text-xs',
};
const icons = { bar: 'h-4 w-4', section: 'h-3.5 w-3.5' };
</script>

<template>
  <button
    v-for="target in targetsFor(props.column)"
    :key="target.id"
    class="flex max-w-[9rem] shrink-0 items-center rounded-full border border-accent/50 font-medium text-accent active:bg-accent/15"
    :class="classes[props.size]"
    :data-testid="props.size === 'bar' ? target.id : `${target.id}-${props.column.key}`"
    @click="target.run()"
  >
    <ArrowDownToLine v-if="target.id === 'move-here'" class="shrink-0" :class="icons[props.size]" />
    <Plus v-else-if="target.id === 'tag-add'" class="shrink-0" :class="icons[props.size]" />
    <Minus v-else class="shrink-0" :class="icons[props.size]" />
    <span class="truncate">{{ target.label }}</span>
  </button>
</template>
