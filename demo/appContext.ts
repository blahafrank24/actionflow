import { reactive, ref } from 'vue';
import type { InjectionKey } from 'vue';
import type { InvoiceForm } from './actions/form';
import type { Navigator } from './actions/router';
import type { InvoiceTable } from './actions/table';
import type { Invoice } from './api/fakeBackend';
import { createDemo } from './createDemo';

export function createAppContext(router: Navigator, { latencyMs }: { latencyMs?: number } = {}) {
  const form = reactive<InvoiceForm>({
    invoice: { customer: 'Customer 1', amount: 120 },
    notify: true,
  });
  const rows = ref<Invoice[]>([]);
  const table: InvoiceTable = {
    append: (row) => void rows.value.push(row),
    // The rows are reactive proxies, so identity can't be compared; ids can.
    remove: (row) => {
      rows.value = rows.value.filter((r) => r.id !== row.id);
    },
  };
  const demo = createDemo({
    router,
    table,
    // A snapshot, so editing the form later can't change a finished run's trace.
    readForm: () => ({ invoice: { ...form.invoice }, notify: form.notify }),
    ...(latencyMs === undefined ? {} : { latencyMs }),
  });
  return { demo, form, rows, router };
}

export type AppContext = ReturnType<typeof createAppContext>;

export const appKey: InjectionKey<AppContext> = Symbol('app');
