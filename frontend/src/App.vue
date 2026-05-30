<script setup lang="ts">
import KanbanBoard from './components/KanbanBoard.vue';
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-violet-500/30">
    <KanbanBoard />
  </div>
</template>

<style>
/* Global resets and body styling */
html, body {
  background-color: #0f172a; /* slate-900 */
  margin: 0;
  padding: 0;
  font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}
</style>
