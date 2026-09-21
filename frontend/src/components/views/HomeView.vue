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

const { projects, projectsLoaded } = storeToRefs(projectStore);
const { pinnedProjectIds } = storeToRefs(settingsStore);

const togglePin = (projectId: string) => {
  if (pinnedProjectIds.value.includes(projectId)) {
    settingsStore.unpinProject(projectId);
  } else {
    settingsStore.pinProject(projectId);
  }
};

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
  <div
    class="h-full w-full flex items-start md:items-center justify-center p-3.5 sm:p-6 overflow-y-auto scroller-thin bg-theme-base/20 select-none"
  >
    <div class="max-w-4xl w-full flex flex-col items-center text-center space-y-4 sm:space-y-8 py-4 sm:py-8 animate-fade-in">
      <!-- Welcome Hero Header -->
      <div class="space-y-2 sm:space-y-3.5 relative">
        <div
          class="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-theme-primary/10 rounded-full blur-2xl pointer-events-none"
        ></div>
        <div class="inline-flex p-2 sm:p-3.5 text-theme-accent">
          <Kanban class="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight text-theme-text-main">
          <span>{{ welcomeParts.prefix }}</span>
          <span class="text-theme-accent">{{ welcomeParts.brand }}</span>
          <span>{{ welcomeParts.suffix }}</span>
        </h1>
        <p class="text-xs sm:text-sm font-medium text-theme-text-muted max-w-md mx-auto italic">
          {{ t('home.subtitle') }}
        </p>
      </div>

      <!-- Action Area -->
      <div
        class="w-full bg-theme-card/30 backdrop-blur-md border border-theme-border/65 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 md:p-8 shadow-xl space-y-4 sm:space-y-6 min-h-[160px] sm:min-h-[220px] flex flex-col justify-center"
      >
        <transition name="view-fade" mode="out-in">
          <!-- Loading indicator while initial projects request is in-flight -->
          <div v-if="!projectsLoaded" key="loading" class="flex flex-col items-center justify-center py-6 sm:py-10 gap-2">
            <div class="w-7 h-7 sm:w-8 sm:h-8 border-3 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
            <span class="text-theme-text-muted text-xs font-semibold">{{ t('loading') || 'Loading...' }}</span>
          </div>

          <!-- If projects exist, show grid -->
          <div v-else-if="projects.length > 0" key="projects-grid" class="space-y-3 sm:space-y-6 text-left w-full">
            <h2 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-theme-text-muted flex items-center gap-1.5 sm:gap-2">
              <Folder class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-theme-accent" />
              {{ t('home.selectProject') }}
            </h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              <div
                v-for="project in sortedProjects"
                :key="project.id"
                @click="selectProject(project.id)"
                class="group relative bg-theme-card hover:bg-theme-column/20 border border-theme-border/60 hover:border-theme-primary/40 rounded-lg sm:rounded-xl p-2.5 sm:p-4.5 cursor-pointer shadow-sm transition-all duration-300 hover:shadow-md flex flex-col justify-between h-14 sm:h-36 overflow-hidden active:scale-[0.99]"
              >
                <!-- Highlight background on hover -->
                <div
                  class="absolute inset-0 bg-gradient-to-br from-theme-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                ></div>

                <div class="flex items-center justify-between sm:block min-w-0">
                  <div class="flex items-center sm:items-start justify-between min-w-0 flex-1 mr-2 sm:mr-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <Folder class="w-4 h-4 text-theme-accent sm:hidden shrink-0" />
                      <h3
                        class="font-bold text-sm text-theme-text-main group-hover:text-theme-accent transition-colors truncate"
                        :title="project.title"
                      >
                        {{ project.title }}
                      </h3>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0 ml-1.5 sm:ml-0">
                      <button
                        @click.stop.prevent="togglePin(project.id)"
                        class="p-1 -m-1 rounded transition-colors cursor-pointer"
                        :class="
                          pinnedProjectIds.includes(project.id)
                            ? 'text-theme-accent opacity-100'
                            : 'text-theme-text-muted hover:text-theme-text-main opacity-70 md:opacity-0 md:group-hover:opacity-100'
                        "
                        :title="pinnedProjectIds.includes(project.id) ? t('projects.unpinProject') : t('projects.pinProject')"
                      >
                        <Pin
                          class="w-3.5 h-3.5 shrink-0"
                          :class="{ 'fill-theme-accent text-theme-accent': pinnedProjectIds.includes(project.id) }"
                        />
                      </button>
                      <GitBranch v-if="project.git_remote" class="w-3 h-3 text-theme-accent shrink-0" :title="t('home.gitConnected')" />
                    </div>
                  </div>
                  <p v-if="project.git_remote" class="hidden sm:block text-[10px] text-theme-text-muted truncate mt-1">
                    {{ project.git_remote }}
                  </p>
                </div>

                <div
                  class="hidden sm:flex items-center justify-between text-xs font-bold text-theme-text-muted group-hover:text-theme-accent transition-colors mt-4"
                >
                  <span>{{ t('home.openProject') }}</span>
                  <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>

                <!-- Mobile-only quick arrow indicator -->
                <div class="sm:hidden absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted group-hover:text-theme-accent">
                  <ArrowRight class="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          <!-- If no projects, show beautiful onboarding placeholder -->
          <div v-else key="no-projects" class="flex flex-col items-center justify-center text-center space-y-4 py-6 w-full">
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
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 0.15s ease;
}
.view-fade-enter-from,
.view-fade-leave-to {
  opacity: 0;
}
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
