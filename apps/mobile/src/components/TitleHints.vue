<script setup lang="ts">
import { CalendarClock, Flag, Hash, Columns3, X } from '@lucide/vue';
import { t } from '@/i18n';
import type { Hint } from '@/composables/useSmartTitle';

defineProps<{ hints: Hint[] }>();
const emit = defineEmits<{ (e: 'ignore', keyword: string): void }>();

const icons = { date: CalendarClock, priority: Flag, tag: Hash, column: Columns3 } as const;
</script>

<template>
  <!-- What the title says: tapping a chip's cross keeps the words as plain text instead -->
  <ul v-if="hints.length" class="flex flex-wrap gap-2" data-testid="title-hints">
    <li
      v-for="hint in hints"
      :key="hint.id"
      class="inline-flex items-center gap-1 rounded-full bg-accent/15 py-1 pl-3 pr-1 text-sm text-accent"
      data-testid="title-hint"
    >
      <component :is="icons[hint.kind]" class="h-3.5 w-3.5" />{{ hint.label }}
      <button
        class="flex h-6 w-6 items-center justify-center rounded-full active:bg-black/10"
        :aria-label="t('hint.keepText')"
        data-testid="title-hint-ignore"
        @click="emit('ignore', hint.keyword)"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </li>
  </ul>
</template>
