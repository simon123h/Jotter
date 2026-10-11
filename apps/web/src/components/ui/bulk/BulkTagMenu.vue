<script setup lang="ts">
import { ref } from 'vue';
import { X, Plus } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import TagInput from '@/components/ui/TagInput.vue';
import { sanitizeTags } from '@/utils/tagUtils';

defineProps<{
  commonTags: string[];
}>();

const emit = defineEmits<{
  (e: 'edit-tag', tag: string, forceRemove: boolean): void;
}>();

const { t } = useI18n();
const tagInputRef = ref<any>(null);
const newTagName = ref('');

const handleAddTag = () => {
  if (newTagName.value.trim()) {
    for (const tag of sanitizeTags(newTagName.value)) {
      emit('edit-tag', tag, false);
    }
    newTagName.value = '';
  }
};

defineExpose({
  focus: () => tagInputRef.value?.focus(),
});
</script>

<template>
  <div class="p-2 space-y-3">
    <!-- Common Tags Toggles -->
    <div v-if="commonTags.length" class="flex flex-wrap gap-1 max-w-[240px]">
      <div
        v-for="tag in commonTags"
        :key="tag"
        @click="emit('edit-tag', tag, false)"
        class="flex items-center gap-1.5 px-2 py-0.5 rounded border border-theme-border bg-theme-column/30 text-[10px] font-bold uppercase tracking-wider text-theme-text-muted cursor-pointer"
      >
        <span>{{ tag }}</span>
        <button
          @click="emit('edit-tag', tag, true)"
          type="button"
          class="flex items-center justify-center p-0.5 -mr-1 rounded-full hover:bg-theme-primary/20 hover:text-theme-accent transition-all cursor-pointer"
          :aria-label="t('buttons.removeTag')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2 w-full">
      <TagInput
        ref="tagInputRef"
        v-model="newTagName"
        @enter="handleAddTag"
        :placeholder="t('bulkActions.tagNamePlaceholder')"
        input-class="w-full bg-theme-base border border-theme-border rounded px-2 py-1 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
        placement="top"
      />
      <button @click="handleAddTag" class="p-1 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer shrink-0">
        <Plus class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
