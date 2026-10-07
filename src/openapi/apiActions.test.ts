import createClient from 'openapi-fetch';
import { describe, expect, it } from 'vitest';
import { action, createFlow } from '../core';
import { apiActions, HttpError } from './index';
import type { paths } from './fixture';

interface Recorded {
  method: string;
  url: string;
  body: unknown;
  signal: AbortSignal;
}

function setup(respond: (req: Request) => Response | Promise<Response>) {
  const requests: Recorded[] = [];
  const client = createClient<paths>({
    baseUrl: 'http://test',
    fetch: async (req: Request) => {
      const text = await req.clone().text();
      requests.push({
        method: req.method,
        url: req.url,
        body: text ? JSON.parse(text) : undefined,
        signal: req.signal,
      });
      return respond(req);
    },
  });
  const api = apiActions(client, [
    'GET /invoices',
    'POST /invoices',
    'GET /invoices/{id}',
    'DELETE /invoices/{id}',
  ]);
  return { requests, api, flow: createFlow(api) };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const invoice = { id: 'inv-1', customer: 'Acme', amount: 5 };
const signal = new AbortController().signal;

describe('apiActions runtime', () => {
  it('substitutes path params and returns the 2xx body', async () => {
    const { api, requests } = setup(() => json(invoice));
    const result = await api['api:GET /invoices/{id}'].run({ path: { id: 'inv-1' } }, { signal });
    expect(result).toEqual(invoice);
    expect(requests[0]).toMatchObject({ method: 'GET', url: 'http://test/invoices/inv-1' });
  });

  it('serializes query params', async () => {
    const { api, requests } = setup(() => json([invoice]));
    await api['api:GET /invoices'].run({ query: { status: 'open' } }, { signal });
    expect(requests[0]?.url).toBe('http://test/invoices?status=open');
  });

  it('runs an endpoint with no params', async () => {
    const { api, requests } = setup(() => json([invoice]));
    expect(await api['api:GET /invoices'].run(undefined, { signal })).toEqual([invoice]);
    expect(requests[0]?.url).toBe('http://test/invoices');
  });

  it('sends the body as JSON', async () => {
    const { api, requests } = setup(() => json(invoice, 201));
    const result = await api['api:POST /invoices'].run(
      { body: { customer: 'Acme', amount: 5 } },
      { signal },
    );
    expect(result).toEqual(invoice);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      body: { customer: 'Acme', amount: 5 },
    });
  });

  it('returns undefined for a 204', async () => {
    const { api } = setup(() => new Response(null, { status: 204 }));
    expect(await api['api:DELETE /invoices/{id}'].run({ path: { id: 'x' } }, { signal })).toBe(
      undefined,
    );
  });

  it('throws HttpError with the status and error body on non-2xx', async () => {
    const { api } = setup(() => json({ message: 'nope' }, 422));
    const error = await Promise.resolve(
      api['api:POST /invoices'].run({ body: { customer: '', amount: 0 } }, { signal }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      name: 'HttpError',
      operation: 'POST /invoices',
      status: 422,
      body: { message: 'nope' },
      message: 'POST /invoices failed with 422',
    });
  });

  it('passes through the error body openapi-fetch parsed, an empty string when there is none', async () => {
    const { api } = setup(() => new Response(null, { status: 500 }));
    await expect(api['api:GET /invoices'].run(undefined, { signal })).rejects.toMatchObject({
      status: 500,
      body: '',
    });
  });

  it('lets network errors through unchanged', async () => {
    const { api } = setup(() => Promise.reject(new TypeError('network down')));
    await expect(api['api:GET /invoices'].run(undefined, { signal })).rejects.toThrow(
      'network down',
    );
  });

  it('exposes exactly the listed operations as plain own keys', () => {
    const { api } = setup(() => json({}));
    expect(Object.keys(api)).toEqual([
      'api:GET /invoices',
      'api:POST /invoices',
      'api:GET /invoices/{id}',
      'api:DELETE /invoices/{id}',
    ]);
  });

  it('rejects a malformed operation when the actions are created', () => {
    const client = createClient<paths>({ baseUrl: 'http://test' });
    const bad = (key: string) => () =>
      (apiActions as (c: typeof client, ops: string[]) => unknown)(client, [key]);
    expect(bad('get /invoices')).toThrow('Invalid operation "get /invoices"');
    expect(bad('GET invoices')).toThrow('Invalid operation');
    expect(bad('FETCH /invoices')).toThrow('Invalid operation');
    expect(bad('')).toThrow('Invalid operation');
  });
});

describe('apiActions in a flow', () => {
  const steps = [
    { action: 'api:POST /invoices', params: { body: { customer: 'Acme', amount: 5 } }, as: 'c' },
    { action: 'api:GET /invoices/{id}', params: { path: { id: '$c.id' } }, as: 'got' },
  ];

  it('chains refs between api steps', async () => {
    const { flow, requests } = setup((req) =>
      req.method === 'POST' ? json(invoice, 201) : json(invoice),
    );
    const result = await flow.run(steps);
    expect(result.status).toBe('ok');
    expect(result.ctx.got).toEqual(invoice);
    expect(requests.map((r) => r.url)).toEqual([
      'http://test/invoices',
      'http://test/invoices/inv-1',
    ]);
  });

  it('validates api action names at runtime', () => {
    const { flow } = setup(() => json({}));
    expect(flow.validate(steps).ok).toBe(true);
    const bad = flow.validate([{ action: 'api:GET /nope' }]);
    expect(bad).toEqual({
      ok: false,
      issues: [{ index: 0, path: 'action', message: 'Unknown action: api:GET /nope' }],
    });
  });

  it('fails the run with the HttpError as the step error', async () => {
    const { flow } = setup(() => json({ message: 'gone' }, 404));
    const result = await flow.run([
      { action: 'api:GET /invoices/{id}', params: { path: { id: 'x' } } },
    ]);
    expect(result.status).toBe('failed');
    expect(result.error?.error).toBeInstanceOf(HttpError);
    expect(result.error?.error).toMatchObject({ status: 404, body: { message: 'gone' } });
  });

  it('honours onError: continue on an HTTP failure', async () => {
    const { flow } = setup(() => json({ message: 'gone' }, 404));
    const result = await flow.run([
      { action: 'api:GET /invoices/{id}', params: { path: { id: 'x' } }, onError: 'continue' },
      { action: 'api:GET /invoices' },
    ]);
    expect(result.trace.map((e) => e.type)).toEqual([
      'step:start',
      'step:error',
      'step:start',
      'step:error',
    ]);
  });

  it('rolls back earlier steps after an HTTP failure', async () => {
    const undone: string[] = [];
    const { api, requests } = setup((req) =>
      req.method === 'POST' ? json(invoice, 201) : json({ message: 'boom' }, 500),
    );
    const flow = createFlow({
      ...api,
      'api.created': action((p: { id: string }) => p.id, {
        undo: (_p, id) => void undone.push(id),
      }),
    });
    const result = await flow.run(
      [
        { action: 'api:POST /invoices', params: { body: { customer: 'A', amount: 1 } }, as: 'c' },
        { action: 'api.created', params: { id: '$c.id' } },
        { action: 'api:GET /invoices/{id}', params: { path: { id: '$c.id' } } },
      ],
      { rollback: true },
    );
    expect(result.status).toBe('failed');
    expect(undone).toEqual(['inv-1']);
    expect(requests).toHaveLength(2);
    expect(result.trace.filter((e) => e.type === 'step:undo')).toHaveLength(1);
  });

  it('passes the run signal to fetch', async () => {
    const controller = new AbortController();
    const { flow, requests } = setup(
      (req) =>
        new Promise<Response>((_resolve, reject) =>
          req.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
    );
    const pending = flow.run([{ action: 'api:GET /invoices' }], { signal: controller.signal });
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    const result = await pending;
    expect(result.status).toBe('aborted');
    expect(requests[0]?.signal.aborted).toBe(true);
  });
});
