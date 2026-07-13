<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { Folder, Plus, ArrowRight, GitBranch, Pin, Kanban } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useProjects } from '@/composables/useProjects';

const { t } = useI18n();
const router = useRouter();

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const { projects } = storeToRefs(projectStore);
const { pinnedProjectIds } = storeToRefs(settingsStore);

const selectProject = (projectId: string) => {
  router.push({
    name: 'project',
    params: { projectId },
  });
};

// Project creation handling using standard projects composable
const { handleCreateProject: runCreateProject } = useProjects(selectProject);

const newProjectTitle = ref('');
const isCreating = ref(false);

const handleCreateProject = async () => {
  const title = newProjectTitle.value.trim();
  if (!title) return;
  isCreating.value = true;
  try {
    await runCreateProject(title);
    await projectStore.fetchProjects(); // sync global project store list
    newProjectTitle.value = '';
  } finally {
    isCreating.value = false;
  }
};

const sortedProjects = computed(() => {
  return [...projects.value].sort((a, b) => {
    const aPinned = pinnedProjectIds.value.includes(a.id);
    const bPinned = pinnedProjectIds.value.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
});

const welcomeParts = computed(() => {
  const full = t('home.welcome');
  const brandName = t('brand.title');
  const index = full.indexOf(brandName);
  if (index === -1) {
    return { prefix: full, brand: '', suffix: '' };
  }
  return {
    prefix: full.slice(0, index),
    brand: brandName,
    suffix: full.slice(index + brandName.length),
  };
});
</script>

<template>
  <div class="h-4/5 w-full flex items-center justify-center p-6 overflow-y-auto scroller-thin bg-theme-base/20 select-none">
    <div class="max-w-4xl w-full flex flex-col items-center text-center space-y-8 py-8 animate-fade-in">
      <!-- Welcome Hero Header -->
      <div class="space-y-3.5 relative">
        <div
          class="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-theme-primary/10 rounded-full blur-2xl pointer-events-none"
        ></div>
        <div class="inline-flex p-3.5 text-theme-accent">
          <Kanban class="w-10 h-10" />
        </div>
        <h1 class="text-4xl font-extrabold tracking-tight text-theme-text-main">
          <span>{{ welcomeParts.prefix }}</span>
          <span class="text-theme-accent">{{ welcomeParts.brand }}</span>
          <span>{{ welcomeParts.suffix }}</span>
        </h1>
        <p class="text-sm font-medium text-theme-text-muted max-w-md mx-auto italic">
          {{ t('home.subtitle') }}
        </p>
      </div>

      <!-- Action Area -->
      <div class="w-full bg-theme-card/30 backdrop-blur-md border border-theme-border/65 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
        <!-- If projects exist, show grid -->
        <div v-if="projects.length > 0" class="space-y-6 text-left">
          <h2 class="text-sm font-bold uppercase tracking-wider text-theme-text-muted flex items-center gap-2">
            <Folder class="w-4 h-4 text-theme-accent" />
            {{ t('home.selectProject') }}
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="project in sortedProjects"
              :key="project.id"
              @click="selectProject(project.id)"
              class="group relative bg-theme-card hover:bg-theme-column/20 border border-theme-border/60 hover:border-theme-primary/40 rounded-xl p-4.5 cursor-pointer shadow-sm transition-all duration-300 hover:shadow-md flex flex-col justify-between h-36 overflow-hidden"
            >
              <!-- Highlight background on hover -->
              <div
                class="absolute inset-0 bg-gradient-to-br from-theme-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              ></div>

              <div>
                <div class="flex items-start justify-between">
                  <h3
                    class="font-bold text-sm text-theme-text-main group-hover:text-theme-accent transition-colors truncate pr-1"
                    :title="project.title"
                  >
                    {{ project.title }}
                  </h3>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <Pin
                      v-if="pinnedProjectIds.includes(project.id)"
                      class="w-3 h-3 text-theme-accent fill-theme-accent shrink-0"
                      title="Pinned"
                    />
                    <GitBranch v-if="project.git_remote" class="w-3 h-3 text-theme-accent shrink-0" title="Git Connected" />
                  </div>
                </div>
                <p v-if="project.git_remote" class="text-[10px] text-theme-text-muted truncate mt-1">
                  {{ project.git_remote }}
                </p>
              </div>

              <div
                class="flex items-center justify-between text-xs font-bold text-theme-text-muted group-hover:text-theme-accent transition-colors mt-4"
              >
                <span>{{ t('home.openProject') }}</span>
                <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>

        <!-- If no projects, show beautiful onboarding placeholder -->
        <div v-else class="flex flex-col items-center justify-center text-center space-y-4 py-6">
          <p class="text-sm font-medium text-theme-text-muted max-w-sm">
            {{ t('home.noProjects') }} <br />
            {{ t('home.createProject') }}
          </p>

          <div class="flex gap-2 max-w-sm w-full justify-center mx-auto">
            <input
              v-model="newProjectTitle"
              type="text"
              :placeholder="t('home.newProjectPlaceholder')"
              class="flex-grow bg-theme-base border border-theme-border rounded-lg px-3.5 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary placeholder-theme-text-muted/50"
              @keydown.enter="handleCreateProject"
              :disabled="isCreating"
            />
            <button
              @click="handleCreateProject"
              class="px-4 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white text-sm font-semibold rounded-lg shadow cursor-pointer transition-colors shrink-0 flex items-center gap-1.5"
              :disabled="isCreating"
            >
              <Plus class="w-4 h-4" />
              <span>{{ t('home.newProjectButton') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-pulse-slow {
  animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
