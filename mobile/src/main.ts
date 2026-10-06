import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useAppStore } from './stores/app';
import { useSettingsStore } from './stores/settings';
import './style.css';

const pinia = createPinia();
// Theme and language first, so the first frame is already right
useSettingsStore(pinia);
// Start opening the vault right away; the app shows a loading state until it is ready
void useAppStore(pinia).init();
createApp(App).use(pinia).mount('#app');
