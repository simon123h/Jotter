<script setup lang="ts">
import { ref } from 'vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';

defineProps<{ submitLabel: string; defaultPath?: string }>();
const emit = defineEmits<{ (e: 'done'): void }>();

const app = useAppStore();
const mode = ref<'create' | 'open'>('create');
const path = ref('');
const name = ref('');
const error = ref('');
const busy = ref(false);
const field = 'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent';

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await app.addVault({ name: name.value, path: path.value, create: mode.value === 'create' });
    emit('done');
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="submit">
    <div class="flex gap-1 rounded-xl bg-line/60 p-1" role="tablist">
      <button
        v-for="m in ['create', 'open'] as const"
        :key="m"
        type="button"
        role="tab"
        :aria-selected="mode === m"
        class="flex-1 rounded-lg px-3 py-2 text-sm font-medium"
        :class="mode === m ? 'bg-card shadow-sm' : 'text-muted'"
        :data-testid="`mode-${m}`"
        @click="mode = m"
      >
        {{ t(m === 'create' ? 'onboarding.create' : 'onboarding.open') }}
      </button>
    </div>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-muted">{{ t('onboarding.folder') }}</span>
      <input v-model="path" required :placeholder="defaultPath ?? 'Jotter'" :class="field" autocapitalize="off" data-testid="vault-path" />
      <span class="mt-1 block text-xs text-muted">{{ t('onboarding.folderHint') }}</span>
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-muted">{{ t('onboarding.name') }}</span>
      <input v-model="name" :class="field" data-testid="vault-name" />
    </label>
    <p v-if="error" class="text-sm text-danger" data-testid="vault-error">{{ error }}</p>
    <button
      type="submit"
      class="w-full rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accent-ink disabled:opacity-40"
      :disabled="busy || !path.trim()"
      data-testid="vault-submit"
    >
      {{ submitLabel }}
    </button>
  </form>
</template>
