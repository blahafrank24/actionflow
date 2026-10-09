import { createFlow } from '@yung_papa/actionflow';
import type { RuntimeStep } from '@yung_papa/actionflow';
import { apiActions } from '@yung_papa/actionflow/openapi';
import { formActions } from './actions/form';
import type { InvoiceForm } from './actions/form';
import { invoiceActions } from './actions/invoices';
import { routerActions } from './actions/router';
import type { Navigator } from './actions/router';
import { tableActions } from './actions/table';
import type { InvoiceTable } from './actions/table';
import { createApiClient, createFakeBackend } from './api/fakeBackend';

export interface DemoDeps {
  router: Navigator;
  table: InvoiceTable;
  readForm: (form: 'invoice') => InvoiceForm;
  latencyMs?: number;
}

export type VariantKey = 'raw' | 'domain' | 'failing';

export interface Variant {
  label: string;
  description: string;
  steps: readonly RuntimeStep[];
  rollback: boolean;
}

export function createDemo({ router, table, readForm, latencyMs }: DemoDeps) {
  const backend = createFakeBackend(latencyMs === undefined ? {} : { latencyMs });
  const client = createApiClient(backend);

  const flow = createFlow({
    ...formActions(readForm),
    ...apiActions(client, ['POST /invoices']),
    ...tableActions({ invoices: table }),
    ...routerActions(router),
    ...invoiceActions(client),
  });

  // Endpoint actions: the sequence knows the API.
  const raw = flow.defineSequence([
    { action: 'form.read', params: { form: 'invoice' }, as: 'form' },
    { action: 'api:POST /invoices', params: { body: '$form.invoice' }, as: 'created' },
    { action: 'table.append', params: { table: 'invoices', row: '$created' } },
    { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
  ]);

  // Domain actions: the sequence knows the business. The send step is skipped unless "notify" is ticked.
  const domain = flow.defineSequence([
    { action: 'form.read', params: { form: 'invoice' }, as: 'form' },
    { action: 'invoices.create', params: { draft: '$form.invoice' }, as: 'created' },
    { action: 'table.append', params: { table: 'invoices', row: '$created' } },
    { action: 'invoices.send', params: { id: '$created.id' }, when: '$form.notify' },
    { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
  ]);

  // The send step always runs and the backend's mail service is down: run with rollback to undo the earlier steps.
  const failing = flow.defineSequence([
    { action: 'form.read', params: { form: 'invoice' }, as: 'form' },
    { action: 'invoices.create', params: { draft: '$form.invoice' }, as: 'created' },
    { action: 'table.append', params: { table: 'invoices', row: '$created' } },
    { action: 'invoices.send', params: { id: '$created.id' } },
    { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
  ]);

  const variants: Record<VariantKey, Variant> = {
    raw: {
      label: 'Endpoint actions',
      description: 'The sequence names the endpoint: api:POST /invoices.',
      steps: raw,
      rollback: false,
    },
    domain: {
      label: 'Domain actions',
      description:
        'The sequence names the business step: invoices.create. The send step is skipped unless notify is ticked.',
      steps: domain,
      rollback: false,
    },
    failing: {
      label: 'Failing send, with rollback',
      description:
        'The mail service is down, so the send step fails. Rollback then undoes the table row and deletes the invoice.',
      steps: failing,
      rollback: true,
    },
  };

  return { backend, client, flow, sequences: { raw, domain, failing }, variants };
}
