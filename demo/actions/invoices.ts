import { action } from '@yung_papa/actionflow';
import { apiActions } from '@yung_papa/actionflow/openapi';
import type { Client } from 'openapi-fetch';
import type { NewInvoice } from '../api/fakeBackend';
import type { paths } from '../api/schema';

// Domain actions: sequences say `invoices.create`, never an endpoint, so the backend can change behind this module.
export function invoiceActions(client: Client<paths>) {
  const api = apiActions(client, [
    'POST /invoices',
    'DELETE /invoices/{id}',
    'POST /invoices/{id}/send',
  ]);
  return {
    'invoices.create': action(
      (params: { draft: NewInvoice }, ctx) =>
        api['api:POST /invoices'].run({ body: params.draft }, ctx),
      {
        undo: async (_params, created, ctx) => {
          await api['api:DELETE /invoices/{id}'].run({ path: { id: created.id } }, ctx);
        },
      },
    ),
    'invoices.send': action((params: { id: string }, ctx) =>
      api['api:POST /invoices/{id}/send'].run({ path: { id: params.id } }, ctx),
    ),
  };
}
