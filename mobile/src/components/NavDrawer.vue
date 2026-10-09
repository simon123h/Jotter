<script setup lang="ts">
import { ref } from 'vue';
import { Database, ChevronsUpDown, Folder, Pencil, Plus, Columns3, Settings, RefreshCw } from '@lucide/vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const rescanning = ref(false);

async function select(id: string) {
  await app.selectProject(id);
  ui.close();
}

async function rescan() {
  rescanning.value = true;
  try {
    await app.refresh({ force: true });
    ui.close();
  } catch (err) {
    ui.showToast(err instanceof Error ? err.message : String(err));
  } finally {
    rescanning.value = false;
  }
}

// A swipe towards the left edge closes the drawer, as it does in other Android apps
let start = { x: 0, y: 0 };
const onTouchStart = (e: TouchEvent) => (start = { x: e.touches[0].clientX, y: e.touches[0].clientY });
const onTouchEnd = (e: TouchEvent) => {
  const touch = e.changedTouches[0];
  if (touch.clientX - start.x < -60 && Math.abs(touch.clientY - start.y) < 40) ui.close();
};

const row = 'flex h-14 w-full items-center gap-4 rounded-full px-4 text-left text-[0.95rem] font-medium active:bg-line';
</script>

<template>
  <div class="fixed inset-0 z-40" role="dialog" aria-modal="true" :aria-label="t('nav.menu')" data-testid="drawer">
    <div class="drawer-scrim absolute inset-0 bg-black/40" data-testid="drawer-scrim" @click="ui.close()"></div>
    <aside
      class="drawer-panel absolute inset-y-0 left-0 flex w-[min(85%,20rem)] flex-col rounded-r-3xl bg-card shadow-2xl"
      style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- The open vault, with the way to switch it -->
      <div class="shrink-0 px-3 pb-2 pt-4">
        <div class="px-4 pb-2 text-xl font-medium">{{ t('app.name') }}</div>
        <button
          :class="`${row} bg-line/60`"
          :aria-label="t('nav.switchVault')"
          data-testid="drawer-vault"
          @click="ui.open({ type: 'vaults' })"
        >
          <Database class="h-5 w-5 shrink-0 text-muted" />
          <span class="min-w-0 flex-1">
            <span class="block truncate leading-tight">{{ app.vault?.name }}</span>
            <span class="block truncate text-xs font-normal text-muted">{{ app.vault?.path }}</span>
          </span>
          <ChevronsUpDown class="h-5 w-5 shrink-0 text-muted" />
        </button>
      </div>

      <div class="flex shrink-0 items-center justify-between px-7 pb-1 pt-3">
        <h2 class="text-sm font-medium text-muted">{{ t('nav.projects') }}</h2>
        <button
          class="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-line"
          :aria-label="t('nav.manageProjects')"
          data-testid="drawer-manage-projects"
          @click="ui.open({ type: 'projects' })"
        >
          <Pencil class="h-4 w-4" />
        </button>
      </div>

      <nav class="min-h-0 flex-1 overflow-y-auto px-3" aria-label="Projects">
        <button
          v-for="p in app.projects"
          :key="p.id"
          :class="[row, p.id === app.projectId ? 'bg-accent/15 text-accent' : '']"
          :aria-current="p.id === app.projectId ? 'page' : undefined"
          data-testid="drawer-project"
          @click="select(p.id)"
        >
          <Folder class="h-5 w-5 shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ p.title }}</span>
        </button>
        <button :class="`${row} text-muted`" data-testid="drawer-new-project" @click="ui.open({ type: 'projects' })">
          <Plus class="h-5 w-5 shrink-0" />{{ t('nav.newProject') }}
        </button>
      </nav>

      <div class="shrink-0 border-t border-line px-3 py-2">
        <button v-if="app.project" :class="row" data-testid="drawer-manage-columns" @click="ui.open({ type: 'columns' })">
          <Columns3 class="h-5 w-5 shrink-0 text-muted" />{{ t('nav.manageColumns') }}
        </button>
        <button :class="row" data-testid="drawer-settings" @click="ui.open({ type: 'settings' })">
          <Settings class="h-5 w-5 shrink-0 text-muted" />{{ t('nav.settings') }}
        </button>
        <button :class="row" :disabled="rescanning" data-testid="drawer-rescan" @click="rescan">
          <RefreshCw class="h-5 w-5 shrink-0 text-muted" :class="{ 'animate-spin': rescanning }" />{{ t('nav.rescan') }}
        </button>
      </div>
    </aside>
  </div>
</template>
