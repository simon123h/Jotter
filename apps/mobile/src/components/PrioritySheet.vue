<script setup lang="ts">
import { computed } from 'vue';
import { Check, Flag } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';

const app = useAppStore();
const ui = useUiStore();
const actions = useTaskActions();

const CHOICES = [
  { id: '', color: 'var(--color-muted)' },
  { id: 'low', color: '#94a3b8' },
  { id: 'medium', color: '#3b82f6' },
  { id: 'high', color: '#f97316' },
  { id: 'urgent', color: '#dc2626' },
] as const;

/** The priority every selected task has, when they agree. */
const shared = computed(() => {
  const values = new Set(app.selection.map((id) => app.taskById(id)?.priority ?? ''));
  return values.size === 1 ? [...values][0] : null;
});

async function pick(priority: string) {
  ui.close();
  await actions.setPriority([...app.selection], priority);
}
</script>

<template>
  <BottomSheet :title="`${t('bulk.priority')} · ${app.selectedCount}`" @close="ui.close()">
    <ul class="-mx-4 pb-2" data-testid="priority-list">
      <li v-for="c in CHOICES" :key="c.id">
        <button
          class="flex h-14 w-full items-center gap-4 px-6 text-left text-base active:bg-line"
          :data-testid="`priority-${c.id || 'none'}`"
          @click="pick(c.id)"
        >
          <Flag class="h-5 w-5 shrink-0" :style="{ color: c.color }" />
          <span class="min-w-0 flex-1">{{ t(`priority.${c.id || 'none'}` as MessageKey) }}</span>
          <Check v-if="shared === c.id" class="h-5 w-5 text-accent" />
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
