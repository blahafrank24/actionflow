import { describe, expect, it } from 'vitest';
import { createApiClient, createFakeBackend } from './fakeBackend';

function setup(latencyMs = 0) {
  const backend = createFakeBackend({ latencyMs });
  return { backend, client: createApiClient(backend) };
}

describe('fake backend', () => {
  it('creates, lists, gets and deletes invoices', async () => {
    const { client } = setup();
    const created = await client.POST('/invoices', {
      body: { customer: 'Customer 1', amount: 10 },
    });
    expect(created.response.status).toBe(201);
    expect(created.data).toEqual({ id: 'inv-1', customer: 'Customer 1', amount: 10, sent: false });

    expect((await client.GET('/invoices')).data).toHaveLength(1);
    const got = await client.GET('/invoices/{id}', { params: { path: { id: 'inv-1' } } });
    expect(got.data?.customer).toBe('Customer 1');

    const deleted = await client.DELETE('/invoices/{id}', { params: { path: { id: 'inv-1' } } });
    expect(deleted.response.status).toBe(204);
    expect((await client.GET('/invoices')).data).toEqual([]);
  });

  it('numbers invoices sequentially', async () => {
    const { client } = setup();
    const a = await client.POST('/invoices', { body: { customer: 'A', amount: 1 } });
    const b = await client.POST('/invoices', { body: { customer: 'B', amount: 1 } });
    expect([a.data?.id, b.data?.id]).toEqual(['inv-1', 'inv-2']);
  });

  it('rejects an invalid invoice with a 422 problem', async () => {
    const { client } = setup();
    const noCustomer = await client.POST('/invoices', { body: { customer: ' ', amount: 1 } });
    expect(noCustomer.response.status).toBe(422);
    expect(noCustomer.error).toEqual({ message: 'Customer is required' });
    const noAmount = await client.POST('/invoices', { body: { customer: 'A', amount: 0 } });
    expect(noAmount.error).toEqual({ message: 'Amount must be greater than 0' });
  });

  it('answers 404 for an unknown invoice', async () => {
    const { client } = setup();
    const result = await client.GET('/invoices/{id}', { params: { path: { id: 'nope' } } });
    expect(result.response.status).toBe(404);
    expect(result.error).toEqual({ message: 'No invoice nope' });
  });

  it('filters the list by sent', async () => {
    const { client } = setup();
    await client.POST('/invoices', { body: { customer: 'A', amount: 1 } });
    await client.POST('/invoices', { body: { customer: 'B', amount: 1 } });
    await client.POST('/invoices/{id}/send', { params: { path: { id: 'inv-2' } } });
    const sent = await client.GET('/invoices', { params: { query: { sent: true } } });
    expect(sent.data?.map((i) => i.id)).toEqual(['inv-2']);
    const unsent = await client.GET('/invoices', { params: { query: { sent: false } } });
    expect(unsent.data?.map((i) => i.id)).toEqual(['inv-1']);
  });

  it('marks an invoice as sent, or fails with 500 when failSend is on', async () => {
    const { client, backend } = setup();
    await client.POST('/invoices', { body: { customer: 'A', amount: 1 } });
    const ok = await client.POST('/invoices/{id}/send', { params: { path: { id: 'inv-1' } } });
    expect(ok.data?.sent).toBe(true);

    backend.failSend = true;
    const failed = await client.POST('/invoices/{id}/send', { params: { path: { id: 'inv-1' } } });
    expect(failed.response.status).toBe(500);
    expect(failed.error).toEqual({ message: 'The mail service is down' });
  });

  it('resets its state', async () => {
    const { client, backend } = setup();
    await client.POST('/invoices', { body: { customer: 'A', amount: 1 } });
    backend.failSend = true;
    backend.reset();
    expect(backend.invoices()).toEqual([]);
    expect(backend.failSend).toBe(false);
    const next = await client.POST('/invoices', { body: { customer: 'B', amount: 1 } });
    expect(next.data?.id).toBe('inv-1');
  });

  it('waits for the simulated latency', async () => {
    const { client } = setup(30);
    const started = performance.now();
    await client.GET('/invoices');
    expect(performance.now() - started).toBeGreaterThanOrEqual(25);
  });

  it('rejects when the request is aborted during the latency', async () => {
    const { client, backend } = setup(1000);
    const controller = new AbortController();
    const pending = client.GET('/invoices', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeDefined();
    expect(backend.invoices()).toEqual([]);
  });
});
