<script setup lang="ts">
import { Check, Pin, Settings2 } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

async function select(id: string) {
  ui.close();
  if (id !== app.projectId) await app.selectProject(id);
}
</script>

<template>
  <BottomSheet :title="t('projects.title')" @close="ui.close()">
    <ul class="-mx-4 pb-1" data-testid="project-switch-list">
      <li v-for="p in app.orderedProjects" :key="p.id">
        <button
          class="flex h-14 w-full items-center gap-3 px-6 text-left text-base active:bg-line"
          :class="p.id === app.projectId ? 'bg-accent/15 font-semibold text-accent' : ''"
          :aria-current="p.id === app.projectId ? 'true' : undefined"
          data-testid="project-switch-row"
          @click="select(p.id)"
        >
          <span class="min-w-0 flex-1 truncate">{{ p.title }}</span>
          <Pin v-if="app.pinned.includes(p.id)" class="h-4 w-4 shrink-0 fill-current opacity-60" />
          <Check v-if="p.id === app.projectId" class="h-5 w-5 shrink-0" />
        </button>
      </li>
    </ul>
    <button
      class="-mx-4 flex h-14 w-[calc(100%+2rem)] items-center gap-3 border-t border-line px-6 text-left text-base text-muted active:bg-line"
      data-testid="project-switch-manage"
      @click="ui.open({ type: 'projects' })"
    >
      <Settings2 class="h-5 w-5 shrink-0" />{{ t('projects.manage') }}
    </button>
  </BottomSheet>
</template>
