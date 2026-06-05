<script setup lang="ts">
import GlobalDialog from '@/components/ui/GlobalDialog.vue';
</script>

<template>
  <div class="min-h-screen bg-theme-base text-theme-text-main flex flex-col font-sans selection:bg-theme-primary/30">
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
  transition: background-color 0.2s ease;
  font-family: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
}
</style>
