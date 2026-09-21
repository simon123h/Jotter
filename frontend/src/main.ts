import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/style.css';
import App from '@/App.vue';
import router from '@/router';
import { initPersistentStorage } from '@/storage/preferencesStorage';

// Hydrate preferences from native SharedPreferences on mobile before mounting stores & app
async function bootstrap() {
  await initPersistentStorage();

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');
}

bootstrap().catch((err) => {
  console.error('Failed to initialize app:', err);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('ServiceWorker registered with scope: ', reg.scope);
      })
      .catch((err) => {
        console.error('ServiceWorker registration failed: ', err);
      });
  });
}
