import { useEventListener, useActiveElement } from '@vueuse/core';

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
  const activeElement = useActiveElement();

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
        // Ignore keyboard shortcuts when user is actively focused on connected input elements
        const activeEl = (typeof document !== 'undefined' ? document.activeElement : null) || activeElement.value;
        if (
          activeEl &&
          activeEl !== (typeof document !== 'undefined' ? document.body : null) &&
          ('isConnected' in activeEl ? activeEl.isConnected : true) &&
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

  useEventListener(window, 'keydown', handleKeyDown);
}
