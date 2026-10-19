<script setup lang="ts">
import type { Component } from 'vue';
import { X } from '@lucide/vue';
import { t } from '@/i18n';

/**
 * One line of the task page: an icon, what it is, what it is set to. The control (a date input, a select) lies
 * invisibly over the line, so the whole line is what is tapped and the system picker opens from it.
 * Without a value the line is just a label (a reminder); with an empty one it says it is not set.
 */
defineProps<{
  label: string;
  /** Undefined shows no value at all; an empty string shows "not set". */
  value?: string;
  icon?: Component;
  iconColor?: string;
  /** Shows a button that empties the field, once it has a value. */
  clearLabel?: string;
  clearTestid?: string;
}>();
defineEmits<{ (e: 'clear'): void }>();
</script>

<template>
  <div class="relative flex min-h-12 items-center gap-3 px-1">
    <component :is="icon" v-if="icon" class="h-5 w-5 shrink-0" :class="iconColor ? '' : 'text-muted'" :style="{ color: iconColor }" />
    <span v-else class="w-5 shrink-0"></span>
    <span class="shrink-0 text-base">{{ label }}</span>
    <span v-if="value !== undefined" class="min-w-0 flex-1 truncate text-right text-base" :class="value ? '' : 'text-muted'">{{
      value || t('task.notSet')
    }}</span>
    <span v-else class="flex-1"></span>
    <div class="absolute inset-0 [&>*]:absolute [&>*]:inset-0 [&>*]:h-full [&>*]:w-full [&>*]:opacity-0"><slot /></div>
    <button
      v-if="clearLabel && value !== ''"
      type="button"
      class="relative z-10 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-line"
      :aria-label="clearLabel"
      :data-testid="clearTestid"
      @click="$emit('clear')"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>
