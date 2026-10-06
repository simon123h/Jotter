<script setup lang="ts">
import VaultForm from '@/components/VaultForm.vue';
import { t } from '@/i18n';
</script>

<template>
  <main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 overflow-y-auto p-6" data-testid="onboarding">
    <div>
      <h1 class="text-2xl font-semibold">{{ t('onboarding.title') }}</h1>
      <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('onboarding.intro') }}</p>
    </div>
    <VaultForm :submit-label="t('onboarding.start')" default-path="Jotter" />
  </main>
</template>
