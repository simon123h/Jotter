<script setup lang="ts">
import GlobalDialog from '@/components/ui/GlobalDialog.vue';
</script>

<template>
  <div class="h-dvh bg-theme-base text-theme-text-main flex flex-col font-sans selection:bg-theme-primary/30 overflow-hidden">
    <router-view />
    <GlobalDialog />
  </div>
</template>

<style>
/* Global resets and body styling */
html,
body {
  background-color: var(--theme-bg-base); /* dynamic theme color */
  margin: 0;
  padding: 0;
  height: 100dvh;
  overflow: hidden;
  transition: background-color 0.2s ease;
  font-family: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
}
</style>
