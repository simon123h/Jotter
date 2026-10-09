<script setup lang="ts">
import { Columns3, Tag, CalendarClock } from '@lucide/vue';
import { t } from '@/i18n';
import { useAppStore, type View } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const views = [
  { id: 'board', icon: Columns3, label: 'view.board' },
  { id: 'tags', icon: Tag, label: 'view.tags' },
  { id: 'planning', icon: CalendarClock, label: 'view.planning' },
] as const;

function pick(id: View) {
  app.setView(id);
  ui.navHidden = false;
}
</script>

<template>
  <!-- Material navigation bar. It floats over the lists, which leave room for it, so hiding it does not reflow them. -->
  <nav
    class="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card transition-transform duration-200"
    :class="app.navVisible ? '' : 'translate-y-full'"
    style="padding-bottom: env(safe-area-inset-bottom)"
    :inert="!app.navVisible"
    :aria-label="t('nav.view')"
    data-testid="bottom-nav"
  >
    <button
      v-for="v in views"
      :key="v.id"
      class="flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium"
      :class="app.view === v.id ? 'text-ink' : 'text-muted'"
      :aria-current="app.view === v.id ? 'page' : undefined"
      :data-testid="`view-${v.id}`"
      @click="pick(v.id)"
    >
      <span
        class="flex h-8 w-16 items-center justify-center rounded-full transition-colors"
        :class="app.view === v.id ? 'bg-accent/20 text-accent' : ''"
      >
        <component :is="v.icon" class="h-6 w-6" />
      </span>
      {{ t(v.label) }}
    </button>
  </nav>
</template>
