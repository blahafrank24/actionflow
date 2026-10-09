import { action, createFlow } from '@yung_papa/actionflow';

const flow = createFlow({
  'form.read': action(() => ({ customer: 'Ada', amount: 120 })),
  'invoices.create': action(async (p: { draft: { customer: string; amount: number } }) => ({
    id: 'inv-1',
    ...p.draft,
  })),
  'router.push': action((p: { to: string }) => console.log('navigate to', p.to)),
});

const submit = flow.defineSequence([
  { action: 'form.read', as: 'draft' },
  { action: 'invoices.create', params: { draft: '$draft' }, as: 'created' },
  { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
]);

const result = await flow.run(submit);
console.log(result.status); // 'ok'
