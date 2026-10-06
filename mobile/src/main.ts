import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useAppStore } from './stores/app';
import './style.css';

const pinia = createPinia();
// Start opening the vault right away; the app shows a loading state until it is ready
void useAppStore(pinia).init();
createApp(App).use(pinia).mount('#app');
