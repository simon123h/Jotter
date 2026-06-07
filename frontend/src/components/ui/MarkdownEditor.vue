<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { indentWithTab } from '@codemirror/commands';

interface Props {
  modelValue?: string;
  placeholder?: string;
  rows?: number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  rows: 10,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const editorContainer = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;

// Handle editor updates
const onDocChange = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    const value = update.state.doc.toString();
    emit('update:modelValue', value);
  }
});

// Create custom editor theme using CSS variables for dynamic switching
const customTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--theme-text-input)',
      backgroundColor: 'var(--theme-bg-base)',
      borderRadius: '0.375rem',
      border: '1px solid var(--theme-border)',
      fontSize: '0.875rem',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      height: `${props.rows * 1.5}rem`,
    },
    '.cm-scroller': {
      overflow: 'auto',
      borderRadius: '0.375rem',
      lineHeight: '1.5',
      padding: '0.5rem 0',
    },
    '.cm-content': {
      caretColor: 'var(--theme-accent)',
      padding: '0 1rem',
    },
    '&.cm-focused': {
      outline: 'none',
      borderColor: 'var(--theme-primary)',
      boxShadow: '0 0 0 1px var(--theme-ring)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--theme-bg-column)',
      color: 'var(--theme-text-muted)',
      borderRight: '1px solid var(--theme-border)',
      borderRadius: '0.375rem 0 0 0.375rem',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      color: 'var(--theme-text-main)',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--theme-ring) !important',
    },
  },
  { dark: true }
);

onMounted(() => {
  if (!editorContainer.value) return;

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [basicSetup, markdown(), cmPlaceholder(props.placeholder), keymap.of([indentWithTab]), onDocChange, customTheme],
  });

  view = new EditorView({
    state: startState,
    parent: editorContainer.value,
  });
});

onUnmounted(() => {
  if (view) {
    view.destroy();
    view = null;
  }
});

// Sync external value changes to editor
watch(
  () => props.modelValue,
  (newValue) => {
    if (view && newValue !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newValue,
        },
      });
    }
  }
);
</script>

<template>
  <div class="codemirror-wrapper w-full">
    <div ref="editorContainer" class="w-full"></div>
  </div>
</template>

<style>
/* Style CodeMirror internally using CSS classes */
.cm-editor {
  transition:
    border-color 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out;
}

/* Light / dark styling adaptation for CodeMirror tokens */
.cm-editor .tok-header1 {
  font-size: 1.5em;
  font-weight: bold;
  color: var(--theme-primary);
}
.cm-editor .tok-header2 {
  font-size: 1.3em;
  font-weight: bold;
  color: var(--theme-accent);
}
.cm-editor .tok-header3 {
  font-size: 1.15em;
  font-weight: bold;
  color: var(--theme-accent-hover, var(--theme-accent));
}
.cm-editor .tok-strong {
  font-weight: bold;
  color: var(--theme-text-main);
}
.cm-editor .tok-emphasis {
  font-style: italic;
}
.cm-editor .tok-comment {
  color: var(--theme-text-muted);
  opacity: 0.8;
}
.cm-editor .tok-keyword {
  color: var(--theme-accent);
}
.cm-editor .tok-url {
  color: var(--theme-accent);
  text-decoration: underline;
}
.cm-editor .tok-link {
  color: var(--theme-accent);
}
.cm-editor .tok-monospace {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.1);
  padding: 0 2px;
  border-radius: 3px;
}
.cm-editor .tok-meta {
  color: var(--theme-text-muted);
}
.cm-editor .tok-string {
  color: var(--theme-accent-hover, var(--theme-accent));
}

/* CodeMirror placeholder style */
.cm-placeholder {
  color: var(--theme-text-muted) !important;
  opacity: 0.6;
}
</style>
