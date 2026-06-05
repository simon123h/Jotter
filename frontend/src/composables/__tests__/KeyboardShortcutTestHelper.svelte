<script lang="ts">
  import { useKeyboardShortcuts, type ShortcutHandler } from '../useKeyboardShortcuts.svelte';

  let { shortcuts = [] } = $props<{ shortcuts: ShortcutHandler[] }>();
  useKeyboardShortcuts(shortcuts);
</script>

<div>Test component</div>
