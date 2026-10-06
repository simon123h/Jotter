<script setup lang="ts">
import { computed, ref } from 'vue';
import { renderMarkdown, countChecklistItems } from '@/markdown';

const props = defineProps<{ source: string }>();
const emit = defineEmits<{ (e: 'toggle', index: number): void }>();

const root = ref<HTMLElement | null>(null);
const html = computed(() => renderMarkdown(props.source));

function onClick(event: MouseEvent) {
  const box = event.target as HTMLElement;
  if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox') return;
  // The text is the truth: only flip an item when the page and the source agree on how many there are
  event.preventDefault();
  const total = root.value?.querySelectorAll('input[type="checkbox"]').length ?? 0;
  if (total === countChecklistItems(props.source)) emit('toggle', Number(box.dataset.check));
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html: sanitised in renderMarkdown -->
  <div ref="root" class="md" data-testid="markdown" @click="onClick" v-html="html"></div>
</template>
