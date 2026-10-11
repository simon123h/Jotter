import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/style.css';
import App from '@/App.vue';
import router from '@/router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

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
