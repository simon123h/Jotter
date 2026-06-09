<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { getKeywordMatches } from '@/utils/titleParser';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    bucketNames?: string[];
    locale?: string;
    ignoredKeywords: Set<string>;
    required?: boolean;
  }>(),
  {
    placeholder: '',
    bucketNames: () => [],
    locale: 'en',
    required: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:ignoredKeywords', value: Set<string>): void;
  (e: 'input', event: Event): void;
  (e: 'keydown', event: KeyboardEvent): void;
  (e: 'keyup', event: KeyboardEvent): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'click', event: MouseEvent): void;
}>();

const inputEl = ref<HTMLInputElement | null>(null);
const overlayEl = ref<HTMLDivElement | null>(null);

// Sync scroll left
const handleScroll = () => {
  if (inputEl.value && overlayEl.value) {
    overlayEl.value.scrollLeft = inputEl.value.scrollLeft;
  }
};

// Listen to input scroll dynamically
watch(inputEl, (newVal) => {
  if (newVal) {
    newVal.addEventListener('scroll', handleScroll);
  }
});

onMounted(() => {
  if (inputEl.value) {
    inputEl.value.addEventListener('scroll', handleScroll);
  }
});

onUnmounted(() => {
  if (inputEl.value) {
    inputEl.value.removeEventListener('scroll', handleScroll);
  }
});

// Tokenize title text
const tokens = computed(() => {
  const text = props.modelValue;
  const matches = getKeywordMatches(text, props.locale, props.bucketNames, props.ignoredKeywords);

  const segments: Array<{
    text: string;
    isKeyword: boolean;
    type: 'tag' | 'bucket' | 'priority' | 'date' | 'text';
    keyword?: string;
  }> = [];

  let idx = 0;
  matches.forEach((m) => {
    if (m.start > idx) {
      segments.push({
        text: text.substring(idx, m.start),
        isKeyword: false,
        type: 'text',
      });
    }
    segments.push({
      text: text.substring(m.start, m.end),
      isKeyword: true,
      type: m.type,
      keyword: m.keyword,
    });
    idx = m.end;
  });

  if (idx < text.length) {
    segments.push({
      text: text.substring(idx),
      isKeyword: false,
      type: 'text',
    });
  }

  return segments;
});

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Backspace' && inputEl.value) {
    const start = inputEl.value.selectionStart;
    const end = inputEl.value.selectionEnd;
    if (start !== null && start === end) {
      // Find if there is an active match ending exactly at the cursor
      const matches = getKeywordMatches(props.modelValue, props.locale, props.bucketNames, props.ignoredKeywords);
      const matchingKeyword = matches.find((m) => m.end === start);
      if (matchingKeyword) {
        event.preventDefault();
        rejectKeyword(matchingKeyword.keyword);
        return;
      }
    }
  }
  emit('keydown', event);
};

// Reject/Ignore a keyword on click
const rejectKeyword = (keyword: string) => {
  const updated = new Set(props.ignoredKeywords);
  updated.add(keyword);
  emit('update:ignoredKeywords', updated);
};

// Expose methods/elements for parent integration
const focus = () => {
  inputEl.value?.focus();
};

const select = () => {
  inputEl.value?.select();
};

const setSelectionRange = (start: number, end: number) => {
  inputEl.value?.setSelectionRange(start, end);
};

defineExpose({
  focus,
  select,
  setSelectionRange,
  inputEl,
});
</script>

<template>
  <div class="relative w-full flex items-center">
    <!-- Overlay/Highlighter container (rendered on top of input, pointer-events-none) -->
    <div
      ref="overlayEl"
      class="absolute inset-0 px-3 py-1.5 text-sm font-sans pointer-events-none select-none overflow-hidden border border-transparent whitespace-pre flex items-center leading-normal bg-transparent"
    >
      <!-- Sub-container to mimic scrolling and text layout perfectly -->
      <div class="inline-block whitespace-pre leading-normal align-middle">
        <template v-for="(t, i) in tokens" :key="i">
          <!-- Keyword highlights -->
          <span
            v-if="t.isKeyword"
            class="relative inline-block text-transparent whitespace-pre select-none font-sans shrink-0 align-middle"
          >
            <!-- Background Pill (absolute positioned, styled, captures pointer events) -->
            <span
              @click.stop.prevent="rejectKeyword(t.keyword!)"
              class="absolute inset-y-[-1px] -left-1 -right-1 pointer-events-auto cursor-pointer border rounded transition-all select-none"
              :class="{
                'bg-purple-500/15 border-purple-500/35 hover:bg-purple-500/30 text-purple-400': t.type === 'tag',
                'bg-amber-500/15 border-amber-500/35 hover:bg-amber-500/30 text-amber-400': t.type === 'bucket',
                'bg-emerald-500/15 border-emerald-500/35 hover:bg-emerald-500/30 text-emerald-400': t.type === 'date',
                'bg-blue-500/15 border-blue-500/35 hover:bg-blue-500/30 text-blue-400': t.type === 'priority' && t.keyword!.includes('p1'),
                'bg-teal-500/15 border-teal-500/35 hover:bg-teal-500/30 text-teal-400': t.type === 'priority' && t.keyword!.includes('p2'),
                'bg-orange-500/15 border-orange-500/35 hover:bg-orange-500/30 text-orange-400':
                  t.type === 'priority' && t.keyword!.includes('p3'),
                'bg-rose-500/15 border-rose-500/35 hover:bg-rose-500/30 text-rose-400':
                  t.type === 'priority' && (t.keyword!.includes('p4') || t.keyword!.includes('p0')),
              }"
              :title="`Click to ignore as keyword`"
            ></span>
            <!-- Hidden text of the keyword to preserve the exact layout and width of the keyword -->
            <span class="relative z-10">{{ t.text }}</span>
          </span>
          <!-- Standard text is completely transparent to show real input text below -->
          <span v-else class="text-transparent whitespace-pre align-middle">{{ t.text }}</span>
        </template>
      </div>
    </div>

    <!-- Real input (placed underneath, text is normal and caret is fully visible, handles typing/selection) -->
    <input
      ref="inputEl"
      type="text"
      :value="modelValue"
      @input="
        emit('update:modelValue', ($event.target as HTMLInputElement).value);
        emit('input', $event);
      "
      @keyup="emit('keyup', $event)"
      @keydown="handleKeyDown($event)"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
      @click="emit('click', $event)"
      :placeholder="placeholder"
      :required="required"
      class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring font-sans"
    />
  </div>
</template>

<style scoped>
/* Perfect scrollbar sync hiding scrollbar on overlay */
div::-webkit-scrollbar {
  display: none;
}
div {
  scrollbar-width: none;
}
</style>
