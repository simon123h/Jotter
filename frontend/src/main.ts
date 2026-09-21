import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/style.css';
import App from '@/App.vue';
import router from '@/router';

import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeMobile } from '@/storage';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

if (isNativeMobile) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
}

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
