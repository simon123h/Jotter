<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { indentWithTab } from '@codemirror/commands';
import { Mic, MicOff } from '@lucide/vue';
import { useSpeechRecognition } from '@/composables/useSpeechRecognition';
import { useI18n } from '@/composables/useI18n';

interface Props {
  modelValue?: string;
  placeholder?: string;
  rows?: number;
  showDictation?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  rows: 10,
  showDictation: true,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { t } = useI18n();
const { isSupported, isListening, startListening, stopListening } = useSpeechRecognition();

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

const appendTextAndFocus = (text: string) => {
  if (!view) return;
  const length = view.state.doc.length;
  let textToInsert = text;
  if (length > 0) {
    const docStr = view.state.doc.toString();
    if (!docStr.endsWith('\n')) {
      textToInsert = '\n' + text;
    }
  }

  view.dispatch({
    changes: {
      from: length,
      insert: textToInsert,
    },
    selection: {
      anchor: length + textToInsert.length,
    },
    scrollIntoView: true,
  });
  view.focus();
};

const handleDictationToggle = () => {
  if (isListening.value) {
    stopListening();
  } else {
    startListening({
      continuous: false,
      onResult: (spokenText, isFinal) => {
        if (isFinal && spokenText.trim()) {
          appendTextAndFocus(spokenText.trim());
        }
      },
    });
  }
};

const focus = () => {
  if (view) {
    view.focus();
  }
};

defineExpose({
  appendTextAndFocus,
  focus,
});
</script>

<template>
  <div class="codemirror-wrapper w-full relative group">
    <div ref="editorContainer" class="w-full"></div>

    <!-- Dictation Mic button in top-right corner of editor -->
    <button
      v-if="showDictation && isSupported"
      type="button"
      @click.stop.prevent="handleDictationToggle"
      class="absolute top-2 right-2 p-1.5 rounded-md transition-all focus:outline-none z-10 cursor-pointer shadow-sm border border-theme-border/40"
      :class="
        isListening
          ? 'text-rose-400 bg-rose-500/20 border-rose-500/40 animate-pulse'
          : 'text-theme-muted hover:text-theme-primary bg-theme-base/80 hover:bg-theme-hover opacity-60 group-hover:opacity-100'
      "
      :title="isListening ? t('speech.stopListening') : t('speech.startDictation')"
      tabindex="-1"
    >
      <Mic v-if="!isListening" class="w-3.5 h-3.5" />
      <MicOff v-else class="w-3.5 h-3.5" />
    </button>
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
