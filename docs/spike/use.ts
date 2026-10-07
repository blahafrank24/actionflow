import { action, createFlow } from './types';

interface Draft { customer: string; amount: number }
interface Invoice { id: string; customer: string; amount: number }

const flow = createFlow({
  'form.read': action((_p: { form: string }) => ({ customer: 'A', amount: 1 }) as Draft),
  'api.createInvoice': action((p: { body: Draft }) => ({ id: '1', ...p.body }) as Invoice),
  'table.append': action((_p: { table: string; row: Invoice }) => undefined),
  'router.push': action((_p: { to: string; id?: string }) => undefined),
});

export const ok = flow.defineSequence([
  { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
  { action: 'api.createInvoice', params: { body: '$draft' }, as: 'created' },
  { action: 'table.append', params: { table: 'invoices', row: '$created' } },
  { action: 'router.push', params: { to: '/invoices', id: '$created.id' } },
]);

export const badName = flow.defineSequence([
  { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
  // @ts-expect-error unknown ref
  { action: 'api.createInvoice', params: { body: '$drafty' } },
]);

export const badType = flow.defineSequence([
  { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
  // @ts-expect-error draft is not an Invoice
  { action: 'table.append', params: { table: 'x', row: '$draft' } },
]);

export const badOrder = flow.defineSequence([
  // @ts-expect-error used before produced
  { action: 'table.append', params: { table: 'x', row: '$created' } },
  { action: 'api.createInvoice', params: { body: { customer: 'a', amount: 1 } }, as: 'created' },
]);

export const badAction = flow.defineSequence([
  // @ts-expect-error unknown action
  { action: 'nope', params: {} },
]);
