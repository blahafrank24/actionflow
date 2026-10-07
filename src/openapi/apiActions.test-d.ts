import createClient from 'openapi-fetch';
import { describe, expectTypeOf, it } from 'vitest';
import { action, createFlow } from '../core';
import type { ParamsOf, ResultOf } from '../core';
import { apiActions } from './index';
import type { OperationKey } from './index';
import type { Invoice, NewInvoice, paths } from './fixture';

const client = createClient<paths>({ baseUrl: 'http://test' });
const api = apiActions(client, [
  'GET /invoices',
  'POST /invoices',
  'GET /invoices/{id}',
  'DELETE /invoices/{id}',
  'PATCH /invoices/{id}',
]);
const flow = createFlow({
  ...api,
  'form.read': action((): NewInvoice => ({ customer: 'Acme', amount: 1 })),
  'ui.name': action((p: { name: number }) => void p),
});

describe('apiActions registry', () => {
  it('keys actions by api:METHOD /path, only for the listed operations', () => {
    expectTypeOf<keyof typeof api>().toEqualTypeOf<
      | 'api:GET /invoices'
      | 'api:POST /invoices'
      | 'api:GET /invoices/{id}'
      | 'api:DELETE /invoices/{id}'
      | 'api:PATCH /invoices/{id}'
    >();
  });

  it('lists only operations the spec defines', () => {
    expectTypeOf<OperationKey<paths>>().toEqualTypeOf<
      | 'GET /invoices'
      | 'POST /invoices'
      | 'GET /invoices/{id}'
      | 'DELETE /invoices/{id}'
      | 'PATCH /invoices/{id}'
    >();
  });

  it('derives params from the operation', () => {
    expectTypeOf<ParamsOf<(typeof api)['api:POST /invoices']>>().toEqualTypeOf<{
      body: NewInvoice;
    }>();
    expectTypeOf<ParamsOf<(typeof api)['api:GET /invoices/{id}']>>().toEqualTypeOf<{
      path: { id: string };
    }>();
    expectTypeOf<ParamsOf<(typeof api)['api:GET /invoices']>>().toEqualTypeOf<
      { query?: { status?: 'open' | 'paid' } } | undefined
    >();
    expectTypeOf<ParamsOf<(typeof api)['api:PATCH /invoices/{id}']>>().toEqualTypeOf<{
      path: { id: string };
      body?: Partial<NewInvoice>;
    }>();
  });

  it('derives the result from the 2xx response', () => {
    expectTypeOf<ResultOf<(typeof api)['api:POST /invoices']>>().toEqualTypeOf<Invoice>();
    expectTypeOf<ResultOf<(typeof api)['api:GET /invoices']>>().toEqualTypeOf<Invoice[]>();
    expectTypeOf<ResultOf<(typeof api)['api:DELETE /invoices/{id}']>>().toEqualTypeOf<undefined>();
  });
});

describe('sequences with api actions', () => {
  it('accepts a ref chain through api actions', () => {
    const seq = flow.defineSequence([
      { action: 'form.read', as: 'draft' },
      { action: 'api:POST /invoices', params: { body: '$draft' }, as: 'created' },
      { action: 'api:GET /invoices/{id}', params: { path: { id: '$created.id' } }, as: 'invoice' },
      { action: 'api:GET /invoices' },
      { action: 'api:GET /invoices', params: { query: { status: 'open' } } },
      { action: 'api:DELETE /invoices/{id}', params: { path: { id: '$invoice.id' } } },
      { action: 'api:PATCH /invoices/{id}', params: { path: { id: 'x' }, body: { amount: 2 } } },
    ]);
    expectTypeOf(seq[1].action).toEqualTypeOf<'api:POST /invoices'>();
  });

  it('rejects bad api steps on the offending value', () => {
    flow.defineSequence([
      // @ts-expect-error body is missing a required field
      { action: 'api:POST /invoices', params: { body: { customer: 'Acme' } } },
    ]);
    flow.defineSequence([
      // @ts-expect-error a required path param is missing
      { action: 'api:GET /invoices/{id}', params: { path: {} } },
    ]);
    // @ts-expect-error params are required when the operation has a required path param
    flow.defineSequence([{ action: 'api:GET /invoices/{id}' }]);
    flow.defineSequence([
      // @ts-expect-error status must be 'open' or 'paid'
      { action: 'api:GET /invoices', params: { query: { status: 'late' } } },
    ]);
    flow.defineSequence([
      // @ts-expect-error PUT /invoices/{id} is not in this registry
      { action: 'api:PUT /invoices/{id}', params: { path: { id: 'x' } } },
    ]);
    flow.defineSequence([
      { action: 'form.read', as: 'draft' },
      // @ts-expect-error $draft is a NewInvoice, not a string path param
      { action: 'api:GET /invoices/{id}', params: { path: { id: '$draft' } } },
    ]);
    flow.defineSequence([
      { action: 'form.read', as: 'draft' },
      // @ts-expect-error $draft.nope does not exist
      { action: 'api:POST /invoices', params: { body: '$draft.nope' } },
    ]);
  });

  it('keeps other actions working beside api actions', () => {
    flow.defineSequence([{ action: 'ui.name', params: { name: 1 } }]);
  });
});

describe('apiActions arguments', () => {
  it('rejects operations the spec does not have', () => {
    // @ts-expect-error not an operation of this spec
    apiActions(client, ['GET /nope']);
    // @ts-expect-error POST /invoices/{id} is `never` in the spec
    apiActions(client, ['POST /invoices/{id}']);
    // @ts-expect-error the operations list is required
    apiActions(client);
    // @ts-expect-error lowercase methods are not valid keys
    apiActions(client, ['get /invoices']);
  });
});
