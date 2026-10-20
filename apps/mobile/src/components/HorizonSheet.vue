<script setup lang="ts">
import { Check } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { HORIZONS } from '@jotter/task-filter';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();
</script>

<template>
  <BottomSheet :title="t('horizon.title')" @close="ui.close()">
    <ul class="-mx-4 pb-2" data-testid="horizon-list">
      <li v-for="horizon in HORIZONS" :key="horizon">
        <button
          class="flex h-14 w-full items-center gap-4 px-6 text-left text-base active:bg-line"
          :data-testid="`horizon-${horizon}`"
          @click="
            app.setHorizon(horizon);
            ui.close();
          "
        >
          <span class="min-w-0 flex-1">{{ t(`horizon.${horizon}` as MessageKey) }}</span>
          <Check v-if="app.hidden[app.view].horizon === horizon" class="h-5 w-5 text-accent" />
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>
