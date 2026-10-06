<script setup lang="ts">
import BottomSheet from './BottomSheet.vue';
import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();
const priorities = ['low', 'medium', 'high', 'urgent'] as const;
const field = 'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent';
</script>

<template>
  <BottomSheet :title="t('common.search')" @close="ui.close()">
    <div class="space-y-3 pb-2">
      <input v-model="app.filter.search" type="search" :placeholder="t('filter.search')" :class="field" data-testid="filter-search" />
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('filter.priority') }}</span>
        <select v-model="app.filter.priority" :class="field" data-testid="filter-priority">
          <option value="">{{ t('filter.anyPriority') }}</option>
          <option v-for="p in priorities" :key="p" :value="p">{{ t(`priority.${p}` as MessageKey) }}</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('filter.tag') }}</span>
        <select v-model="app.filter.tag" :class="field" data-testid="filter-tag">
          <option value="">{{ t('filter.anyTag') }}</option>
          <option v-for="tag in app.allTags" :key="tag" :value="tag">#{{ tag }}</option>
        </select>
      </label>
      <button v-if="app.isFiltering" class="text-sm font-medium text-accent" data-testid="filter-clear" @click="app.resetFilter()">
        {{ t('filter.clear') }}
      </button>
    </div>
  </BottomSheet>
</template>
