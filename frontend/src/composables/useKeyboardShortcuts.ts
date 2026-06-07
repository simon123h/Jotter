import { onMounted, onUnmounted } from 'vue';

export interface ShortcutHandler {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  allowInInputs?: boolean;
  callback: (event: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const match = shortcuts.find((s) => {
      const targetKey = s.key.toLowerCase();
      if (targetKey !== key) return false;

      // Match modifiers strictly if defined, else assume false
      const ctrl = s.ctrlKey ?? false;
      const alt = s.altKey ?? false;
      const shift = s.shiftKey ?? false;
      const meta = s.metaKey ?? false;

      return ctrl === event.ctrlKey && alt === event.altKey && shift === event.shiftKey && meta === event.metaKey;
    });

    if (match) {
      if (!match.allowInInputs) {
        // Ignore keyboard shortcuts when user is focused on input elements
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.hasAttribute('contenteditable'))
        ) {
          return;
        }
      }

      event.preventDefault();
      match.callback(event);
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
