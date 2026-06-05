<script lang="ts">
  import KanbanBoard from '@/components/KanbanBoard.svelte';
  import GlobalDialog from '@/components/ui/GlobalDialog.svelte';
  import { settingsStore } from '@/stores/settings';

  // Apply the theme reactively to the html element
  $effect(() => {
    const theme = settingsStore.currentTheme;
    const docClasses = document.documentElement.classList;
    // Remove existing themes
    docClasses.forEach((c) => {
      if (c.startsWith('theme-')) {
        docClasses.remove(c);
      }
    });
    if (theme !== 'nordic-light') {
      docClasses.add('theme-' + theme);
    }
  });
</script>

<div class="min-h-screen bg-theme-base text-theme-text-main flex flex-col font-sans selection:bg-theme-primary/30">
  <KanbanBoard />
  <GlobalDialog />
</div>

<style>
  :global(html),
  :global(body) {
    background-color: var(--theme-bg-base); /* dynamic theme color */
    margin: 0;
    padding: 0;
    transition: background-color 0.2s ease;
    font-family: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  }
</style>
