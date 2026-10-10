<script setup lang="ts">
import { computed } from 'vue';
import { Folder } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useTaskActions } from '@/composables/useTaskActions';

const app = useAppStore();
const ui = useUiStore();
const actions = useTaskActions();

const others = computed(() => app.orderedProjects.filter((p) => p.id !== app.projectId));

async function pick(projectId: string) {
  ui.close();
  await actions.moveToProject([...app.selection], projectId);
}
</script>

<template>
  <BottomSheet :title="`${t('bulk.project')} · ${app.selectedCount}`" @close="ui.close()">
    <ul v-if="others.length" class="-mx-4 pb-2" data-testid="project-list">
      <li v-for="p in others" :key="p.id">
        <button
          class="flex h-14 w-full items-center gap-4 px-6 text-left text-base active:bg-line"
          :data-testid="`project-${p.id}`"
          @click="pick(p.id)"
        >
          <Folder class="h-5 w-5 shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate">{{ p.title }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="pb-4 text-sm text-muted">{{ t('bulk.noProjects') }}</p>
  </BottomSheet>
</template>
