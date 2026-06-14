<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import { useI18n } from '@/composables/useI18n';
import { toggleChecklistItemInMarkdown } from '@/utils/markdown';

const props = defineProps<{
  body: string;
}>();

const emit = defineEmits<{
  (e: 'update:body', newBody: string): void;
  (e: 'error', message: string): void;
}>();

const { t } = useI18n();

const parsedMarkdown = computed(() => {
  if (!props.body) return '';
  try {
    let checkboxIndex = 0;
    const renderer = new marked.Renderer();
    renderer.checkbox = ({ checked }) => {
      const idx = checkboxIndex++;
      return `<input type="checkbox" data-checkbox-index="${idx}" ${checked ? 'checked' : ''} />`;
    };
    return marked.parse(props.body, { renderer });
  } catch {
    return props.body;
  }
});

const toggleCheckboxInBody = (targetIndex: number, isChecked: boolean) => {
  try {
    const newBody = toggleChecklistItemInMarkdown(props.body, targetIndex, isChecked);
    emit('update:body', newBody);
  } catch (err: any) {
    emit('error', t('errors.updateTask', { message: err.message || err }));
  }
};

const handleMarkdownClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
    const dataIndex = target.getAttribute('data-checkbox-index');
    if (dataIndex !== null) {
      const idx = parseInt(dataIndex, 10);
      const isChecked = (target as HTMLInputElement).checked;
      toggleCheckboxInBody(idx, isChecked);
    }
  }
};
</script>

<template>
  <div>
    <!-- Rendered Markdown -->
    <div
      v-if="body"
      class="markdown-content text-theme-text-card prose prose-invert max-w-none space-y-3 break-all animate-fade-in"
      v-html="parsedMarkdown"
      @click="handleMarkdownClick"
    ></div>
    <div v-else class="text-theme-text-muted italic text-xs py-2">
      {{ t('noDescription') }}
    </div>
  </div>
</template>
