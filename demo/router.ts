import { createRouter } from 'vue-router';
import type { RouterHistory } from 'vue-router';
import InvoiceDetail from './components/InvoiceDetail.vue';
import InvoiceTable from './components/InvoiceTable.vue';

export function createDemoRouter(history: RouterHistory) {
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'invoices', component: InvoiceTable },
      { path: '/invoices/:id', name: 'invoice', component: InvoiceDetail },
    ],
  });
}
