import { createApp } from 'vue';
import { createWebHashHistory } from 'vue-router';
import App from './App.vue';
import { appKey, createAppContext } from './appContext';
import { createDemoRouter } from './router';
import './style.css';

const router = createDemoRouter(createWebHashHistory());

// The latency makes durations visible in the trace.
createApp(App)
  .use(router)
  .provide(appKey, createAppContext(router, { latencyMs: 400 }))
  .mount('#app');
