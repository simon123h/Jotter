<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useClipboard } from '@vueuse/core';
import { X, Clock, RotateCcw, User, Calendar, RefreshCw, Search, Copy, Check } from '@lucide/vue';
import { useProjectStore } from '@/stores/project';
import { getGitHistory } from '@/api';
import type { GitCommit } from '@/types';
import { useI18n } from '@/composables/useI18n';
import BaseModal from '@/components/ui/BaseModal.vue';

const { t } = useI18n();
const { copy } = useClipboard();

const props = defineProps<{
  isOpen: boolean;
  projectId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const projectStore = useProjectStore();

// State
const gitCommits = ref<GitCommit[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const filterText = ref('');
const copiedHash = ref<string | null>(null);

// Find project title if projectId is provided
const projectTitle = computed(() => {
  if (!props.projectId) return null;
  const project = projectStore.projects.find((p) => p.id === props.projectId);
  return project ? project.title : null;
});

// Fetch history
const fetchHistory = async () => {
  loading.value = true;
  error.value = null;
  try {
    gitCommits.value = await getGitHistory(props.projectId);
  } catch (err: any) {
    error.value = err.message || t('timeMachineModal.fetchErrorFallback');
  } finally {
    loading.value = false;
  }
};

// Filtered commits
const filteredCommits = computed(() => {
  const query = filterText.value.toLowerCase().trim();
  if (!query) return gitCommits.value;
  return gitCommits.value.filter((commit) => {
    return (
      commit.message.toLowerCase().includes(query) ||
      commit.author.toLowerCase().includes(query) ||
      commit.id.toLowerCase().includes(query) ||
      commit.short_id.toLowerCase().includes(query)
    );
  });
});

// Restore confirmation & action
const handleRestore = async (commit: GitCommit) => {
  const confirmMsg = t('timeMachineModal.confirmRestore', { message: commit.message, shortId: commit.short_id });
  if (confirm(confirmMsg)) {
    try {
      emit('close');
      await projectStore.restoreToCommit(commit.id, props.projectId);
    } catch (err: any) {
      alert(t('timeMachineModal.restoreFailed', { message: err.message || err }));
    }
  }
};

// Copy commit hash
const handleCopyHash = async (hash: string) => {
  try {
    await copy(hash);
    copiedHash.value = hash;
    setTimeout(() => {
      if (copiedHash.value === hash) {
        copiedHash.value = null;
      }
    }, 2000);
  } catch {
    // Fallback
  }
};

// Format Date
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

// Watch for isOpen changes to auto-fetch history
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      fetchHistory();
      filterText.value = '';
    }
  },
  { immediate: true }
);
</script>

<template>
  <BaseModal :is-open="isOpen" max-width="max-w-3xl" content-class="h-[650px]" @close="emit('close')">
    <template #header>
      <div class="px-6 py-4 border-b border-theme-border flex justify-between items-center bg-theme-card/50 shrink-0">
        <div class="flex flex-col gap-0.5">
          <h3 class="text-base font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-2">
            <Clock class="w-5 h-5 text-theme-primary shrink-0" />
            {{ t('timeMachineModal.title') }}
          </h3>
          <p class="text-xs text-theme-text-muted">
            <span v-if="projectTitle" class="font-medium text-theme-accent">{{
              t('timeMachineModal.projectContext', { title: projectTitle })
            }}</span>
            <span v-else class="font-medium">{{ t('timeMachineModal.globalContext') }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <!-- Refresh Button -->
          <button
            @click="fetchHistory"
            class="p-2 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 rounded-lg transition-colors cursor-pointer"
            :title="t('timeMachineModal.refreshTooltip')"
            :disabled="loading"
          >
            <RefreshCw class="w-4 h-4 shrink-0" :class="{ 'animate-spin': loading }" />
          </button>
          <!-- Close Button -->
          <button
            @click="emit('close')"
            class="text-theme-text-muted hover:text-theme-text-main p-2 hover:bg-theme-column/30 rounded-lg transition-colors cursor-pointer"
          >
            <X class="w-5 h-5 shrink-0" />
          </button>
        </div>
      </div>
    </template>

    <!-- Search Bar and Filter Controls -->
    <div class="px-6 py-3 border-b border-theme-border bg-theme-column/10 flex items-center gap-3 shrink-0">
      <div class="relative flex-grow">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted/70" />
        <input
          v-model="filterText"
          type="text"
          :placeholder="t('timeMachineModal.searchPlaceholder')"
          class="w-full pl-9 pr-4 py-1.5 bg-theme-card border border-theme-border rounded-lg text-xs text-theme-text-main placeholder-theme-text-muted/60 focus:outline-none focus:border-theme-primary transition-colors"
        />
      </div>
      <div class="text-xs text-theme-text-muted shrink-0 font-medium">
        {{ t('timeMachineModal.commitsCount', { count: filteredCommits.length }) }}
      </div>
    </div>

    <!-- Snapshot Scroll View -->
    <div class="flex-grow overflow-y-auto px-6 py-4 scroller-thin">
      <!-- Loading State -->
      <div v-if="loading && gitCommits.length === 0" class="h-full flex flex-col items-center justify-center p-8">
        <RefreshCw class="w-8 h-8 animate-spin text-theme-primary mb-3" />
        <p class="text-sm text-theme-text-muted">{{ t('timeMachineModal.loading') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="h-full flex flex-col items-center justify-center p-8 text-center">
        <div class="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 mb-3">
          <X class="w-6 h-6" />
        </div>
        <p class="text-sm font-semibold text-red-400 mb-1">{{ t('timeMachineModal.errorTitle') }}</p>
        <p class="text-xs text-theme-text-muted max-w-md mb-4">{{ error }}</p>
        <button
          type="button"
          @click="fetchHistory"
          class="px-4 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main rounded-md border border-theme-border text-xs font-semibold cursor-pointer transition-colors"
        >
          {{ t('timeMachineModal.tryAgain') }}
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredCommits.length === 0" class="h-full flex flex-col items-center justify-center p-8 text-center">
        <Clock class="w-8 h-8 text-theme-text-muted/60 mb-2" />
        <p class="text-sm text-theme-text-main font-semibold">{{ t('timeMachineModal.emptyTitle') }}</p>
        <p class="text-xs text-theme-text-muted mt-1">
          {{ filterText ? t('timeMachineModal.emptySearchDesc') : t('timeMachineModal.emptyNoSnapshotsDesc') }}
        </p>
      </div>

      <!-- Commit Cards List -->
      <div v-else class="space-y-3">
        <div
          v-for="(commit, index) in filteredCommits"
          :key="commit.id"
          class="group border border-theme-border rounded-lg bg-theme-card/30 hover:bg-theme-primary/5 hover:border-theme-primary/20 transition-all duration-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in"
        >
          <!-- Info Section -->
          <div class="flex-grow space-y-2 min-w-0">
            <div class="flex items-center gap-2">
              <!-- Latest Snapshot Badge -->
              <span
                v-if="index === 0 && !filterText"
                class="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/15 px-1.5 py-0.5 rounded-full shrink-0"
              >
                {{ t('timeMachineModal.currentStateBadge') }}
              </span>
              <span
                class="text-[10px] font-mono font-bold bg-theme-column px-2 py-0.5 rounded text-theme-text-muted flex items-center gap-1 shrink-0"
              >
                {{ commit.short_id }}
                <!-- Copy Button -->
                <button
                  type="button"
                  @click.stop="handleCopyHash(commit.id)"
                  class="text-theme-text-muted/60 hover:text-theme-text-main transition-colors ml-0.5"
                  :title="copiedHash === commit.id ? t('timeMachineModal.copiedHashTooltip') : t('timeMachineModal.copyHashTooltip')"
                >
                  <Check v-if="copiedHash === commit.id" class="w-3 h-3 text-emerald-500" />
                  <Copy v-else class="w-3 h-3" />
                </button>
              </span>
            </div>

            <!-- Commit Message -->
            <h4 class="text-sm font-semibold text-theme-text-main leading-snug group-hover:text-theme-accent transition-colors break-words">
              {{ commit.message }}
            </h4>

            <!-- Meta row (Author, Date) -->
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-theme-text-muted">
              <span class="flex items-center gap-1.5 truncate max-w-[200px]">
                <User class="w-3.5 h-3.5 text-theme-text-muted/50" />
                {{ commit.author }}
              </span>
              <span class="flex items-center gap-1.5 shrink-0">
                <Calendar class="w-3.5 h-3.5 text-theme-text-muted/50" />
                {{ formatDate(commit.date) }}
              </span>
            </div>
          </div>

          <!-- Action Section -->
          <div class="shrink-0 flex items-center w-full sm:w-auto">
            <button
              type="button"
              @click="handleRestore(commit)"
              class="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-theme-column/30 hover:bg-theme-primary/10 text-theme-text-main hover:text-theme-accent border border-theme-border hover:border-theme-primary/20 rounded-lg text-sm font-semibold transition-all duration-200 group-hover:shadow-sm cursor-pointer"
            >
              <RotateCcw class="w-4 h-4 shrink-0 text-theme-text-muted group-hover:text-theme-accent" />
              {{ t('timeMachineModal.restoreButton') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="px-6 py-4 border-t border-theme-border bg-theme-card/50 flex justify-end shrink-0">
        <button
          type="button"
          @click="emit('close')"
          class="px-5 py-2 border border-theme-border rounded-lg text-sm font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
        >
          {{ t('timeMachineModal.closeButton') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
