<script setup lang="ts">
import { DEFAULT_MOBILE_BUCKETS } from '@jotter/vault-format';
</script>

<template>
  <main class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
    <h1 class="text-2xl font-semibold">Jotter Lite</h1>
    <p class="text-sm opacity-70" data-testid="bucket-names">{{ DEFAULT_MOBILE_BUCKETS.map((b) => b.title).join(' · ') }}</p>
  </main>
</template>
