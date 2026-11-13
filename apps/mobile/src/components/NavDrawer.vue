<script setup lang="ts">
import { Database, ChevronsUpDown, Folder, Pin, Pencil, Plus, Columns3, ListFilter, Settings } from '@lucide/vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

async function select(id: string) {
  await app.selectProject(id);
  ui.close();
}

async function openView(id: string) {
  await app.openView(id);
  ui.close();
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
      class="drawer-panel absolute inset-y-0 left-0 flex w-[min(85%,20rem)] flex-col bg-card shadow-2xl"
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

      <!-- Saved searches, across all projects -->
      <div v-if="app.views.length" class="shrink-0 px-3 pb-1" data-testid="drawer-views">
        <h2 class="px-4 pb-1 pt-3 text-sm font-medium text-muted">{{ t('views.title') }}</h2>
        <div v-for="v in app.views" :key="v.id" class="flex items-center">
          <button
            :class="[row, 'min-w-0 flex-1', app.savedViewId === v.id ? 'bg-accent/15 text-accent' : '']"
            :aria-current="app.savedViewId === v.id ? 'page' : undefined"
            data-testid="drawer-view"
            @click="openView(v.id)"
          >
            <ListFilter class="h-5 w-5 shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ v.name }}</span>
          </button>
          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-line"
            :aria-label="t('views.edit')"
            data-testid="drawer-view-edit"
            @click="ui.open({ type: 'view', id: v.id })"
          >
            <Pencil class="h-4 w-4" />
          </button>
        </div>
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
          v-for="p in app.orderedProjects"
          :key="p.id"
          :class="[row, p.id === app.projectId && !app.scoped ? 'bg-accent/15 text-accent' : '']"
          :aria-current="p.id === app.projectId && !app.scoped ? 'page' : undefined"
          data-testid="drawer-project"
          @click="select(p.id)"
        >
          <Folder class="h-5 w-5 shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ p.title }}</span>
          <Pin v-if="app.pinned.includes(p.id)" class="h-4 w-4 shrink-0 fill-current opacity-60" data-testid="drawer-pinned" />
        </button>
        <button :class="`${row} text-muted`" data-testid="drawer-new-project" @click="ui.open({ type: 'projects' })">
          <Plus class="h-5 w-5 shrink-0" />{{ t('nav.newProject') }}
        </button>
      </nav>

      <div class="shrink-0 border-t border-line px-3 py-2">
        <button
          v-if="app.project && app.view === 'board' && !app.scoped"
          :class="row"
          data-testid="drawer-manage-columns"
          @click="ui.open({ type: 'columns' })"
        >
          <Columns3 class="h-5 w-5 shrink-0 text-muted" />{{ t('nav.manageColumns') }}
        </button>
        <button :class="row" data-testid="drawer-settings" @click="ui.open({ type: 'settings' })">
          <Settings class="h-5 w-5 shrink-0 text-muted" />{{ t('nav.settings') }}
        </button>
      </div>
    </aside>
  </div>
</template>
