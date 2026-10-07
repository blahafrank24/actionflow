import { describe, expectTypeOf, it } from 'vitest';
import { action, createFlow } from './index';
import type { RunResult, TraceEvent } from './index';

interface Draft {
  customer: string;
  amount: number;
}
interface Invoice {
  id: string;
  customer: string;
  amount: number;
  meta: { tags: string[] };
}

const flow = createFlow({
  'form.read': action((p: { form: string }): Draft => ({ customer: p.form, amount: 1 })),
  'api.create': action(
    async (p: { body: Draft }): Promise<Invoice> => ({ id: '1', meta: { tags: [] }, ...p.body }),
    { undo: (_p, result) => void expectTypeOf(result).toEqualTypeOf<Invoice>() },
  ),
  'table.append': action((p: { table: string; row: Invoice }) => void p),
  'router.push': action((p: { to: string; id?: string }) => void p),
  'ui.refresh': action(() => undefined),
  'ui.tags': action((p: { tags: string[] }) => void p),
  'ui.mode': action((p: { mode: 'view' | 'edit' }) => void p),
});

it('accepts a valid sequence and keeps its literal type', () => {
  const seq = flow.defineSequence([
    { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
    { action: 'api.create', params: { body: '$draft' }, as: 'created', onError: 'abort' },
    { action: 'table.append', params: { table: 'invoices', row: '$created' }, when: '$created' },
    { action: 'router.push', params: { to: '/invoices', id: '$created.id' } },
    { action: 'ui.refresh' },
    { action: 'ui.mode', params: { mode: 'edit' } },
  ]);
  expectTypeOf(seq[0].action).toEqualTypeOf<'form.read'>();
  expectTypeOf(seq).toHaveProperty('length').toEqualTypeOf<6>();
});

it('accepts literal values, nested refs and nested paths', () => {
  flow.defineSequence([
    { action: 'api.create', params: { body: { customer: 'a', amount: 1 } }, as: 'created' },
    { action: 'router.push', params: { to: '/x', id: '$created.id' } },
    { action: 'router.push', params: { to: '$created.customer' } },
  ]);
});

it('rejects an unknown action', () => {
  flow.defineSequence([
    // @ts-expect-error unknown action
    { action: 'nope', params: {} },
  ]);
});

it('rejects an unknown ref and names it', () => {
  flow.defineSequence([
    { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
    // @ts-expect-error Unknown ref: $drafty
    { action: 'api.create', params: { body: '$drafty' } },
  ]);
});

it('rejects use before define', () => {
  flow.defineSequence([
    // @ts-expect-error $created is produced by a later step
    { action: 'table.append', params: { table: 'x', row: '$created' } },
    { action: 'api.create', params: { body: { customer: 'a', amount: 1 } }, as: 'created' },
  ]);
});

it('rejects a ref of the wrong type', () => {
  flow.defineSequence([
    { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
    // @ts-expect-error a Draft is not an Invoice
    { action: 'table.append', params: { table: 'x', row: '$draft' } },
  ]);
});

it('rejects a nested path that does not exist', () => {
  flow.defineSequence([
    { action: 'api.create', params: { body: { customer: 'a', amount: 1 } }, as: 'created' },
    // @ts-expect-error $created.nope does not exist
    { action: 'router.push', params: { to: '/x', id: '$created.nope' } },
    // @ts-expect-error amount is a number, id expects a string
    { action: 'router.push', params: { to: '/x', id: '$created.amount' } },
  ]);
});

it('checks template placeholders', () => {
  flow.defineSequence([
    { action: 'api.create', params: { body: { customer: 'a', amount: 1 } }, as: 'created' },
    { action: 'router.push', params: { to: '/invoices/{$created.id}/{$created.amount}' } },
    // @ts-expect-error Unknown ref: $creatd.id
    { action: 'router.push', params: { to: '/invoices/{$creatd.id}' } },
    // @ts-expect-error the second placeholder is unknown
    { action: 'router.push', params: { to: '/{$created.id}/{$nope}' } },
    // @ts-expect-error meta is an object, not a string
    { action: 'router.push', params: { to: '/{$created.meta}' } },
  ]);
});

it('rejects a template for a non-string param', () => {
  flow.defineSequence([
    { action: 'api.create', params: { body: { customer: 'a', amount: 1 } }, as: 'created' },
    // @ts-expect-error mode is a literal union, a template yields string
    { action: 'ui.mode', params: { mode: 'x{$created.id}' } },
  ]);
});

it('treats $$ as a literal escape', () => {
  flow.defineSequence([
    { action: 'router.push', params: { to: '$$not-a-ref' } },
    { action: 'router.push', params: { to: '$${$not.a.template}' } },
  ]);
});

it('checks the when ref', () => {
  flow.defineSequence([
    // @ts-expect-error Unknown ref: $ghost
    { action: 'ui.refresh', when: '$ghost' },
  ]);
});

it('rejects an invalid onError and wrong literal params', () => {
  flow.defineSequence([
    // @ts-expect-error onError must be 'abort' or 'continue'
    { action: 'ui.refresh', onError: 'retry' },
    // @ts-expect-error mode must be 'view' or 'edit'
    { action: 'ui.mode', params: { mode: 'other' } },
    // @ts-expect-error params is required
    { action: 'router.push' },
  ]);
});

it('checks arrays, missing keys and wrong literal kinds', () => {
  flow.defineSequence([
    { action: 'api.create', params: { body: { customer: 'a', amount: 1 } }, as: 'created' },
    { action: 'ui.tags', params: { tags: ['a', '$created.id'] } },
    // @ts-expect-error 3 is not a string
    { action: 'ui.tags', params: { tags: ['a', 3] } },
    // @ts-expect-error amount is missing
    { action: 'api.create', params: { body: { customer: 'a' } } },
    // @ts-expect-error amount must be a number
    { action: 'api.create', params: { body: { customer: 'a', amount: 'x' } } },
  ]);
});

it('types undo from params and result', () => {
  action((p: { id: string }) => p.id.length, {
    undo: (params, result) => {
      expectTypeOf(params).toEqualTypeOf<{ id: string }>();
      expectTypeOf(result).toBeNumber();
    },
  });
  action((p: { id: string }) => p.id.length, {
    // @ts-expect-error result is a number, not a string
    undo: (_params, result: string) => void result,
  });
});

describe('run', () => {
  it('returns a RunResult and accepts typed sequences', () => {
    const seq = flow.defineSequence([
      { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
      { action: 'ui.refresh' },
    ]);
    expectTypeOf(flow.run(seq)).resolves.toEqualTypeOf<RunResult>();
    expectTypeOf<RunResult['status']>().toEqualTypeOf<'ok' | 'failed' | 'aborted'>();
  });

  it('types onEvent as a TraceEvent callback', () => {
    flow.run([], {
      onEvent: (e) => {
        expectTypeOf(e).toEqualTypeOf<TraceEvent>();
        if (e.type === 'step:done') expectTypeOf(e.durationMs).toBeNumber();
        if (e.type === 'step:skip') expectTypeOf(e).not.toHaveProperty('durationMs');
      },
    });
  });

  it('narrows the trace event union on type', () => {
    const check = (e: TraceEvent): number => {
      switch (e.type) {
        case 'step:start':
        case 'step:skip':
        case 'step:done':
        case 'step:error':
        case 'step:undo':
          return e.index;
        default:
          return e satisfies never;
      }
    };
    expectTypeOf(check).returns.toBeNumber();
  });

  it('rejects bad options and steps', () => {
    // @ts-expect-error rollback must be a boolean
    flow.run([], { rollback: 'yes' });
    // @ts-expect-error input must be a record
    flow.run([], { input: 5 });
    // @ts-expect-error onEvent receives a TraceEvent, not a string
    flow.run([], { onEvent: (e: string) => e });
    // @ts-expect-error unknown option
    flow.run([], { retries: 3 });
    // @ts-expect-error a step needs an action name
    flow.run([{ params: {} }]);
    // @ts-expect-error when must be a $ref
    flow.run([{ action: 'ui.refresh', when: 'draft' }]);
    // @ts-expect-error onError must be abort or continue
    flow.run([{ action: 'ui.refresh', onError: 'retry' }]);
  });
});
