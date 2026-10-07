import { HttpError } from 'actionflow/openapi';
import { describe, expect, it } from 'vitest';
import type { Invoice } from './api/fakeBackend';
import { createDemo } from './createDemo';
import type { InvoiceForm } from './actions/form';

function setup(form: Partial<InvoiceForm> = {}, latencyMs = 0) {
  const rows: Invoice[] = [];
  const pushed: string[] = [];
  const state: InvoiceForm = {
    invoice: { customer: 'Customer 1', amount: 25 },
    notify: true,
    ...form,
  };
  const demo = createDemo({
    router: { push: (to) => void pushed.push(to) },
    table: {
      append: (row) => void rows.push(row),
      remove: (row) => void rows.splice(rows.indexOf(row), 1),
    },
    readForm: () => state,
    latencyMs,
  });
  return { demo, rows, pushed, state };
}

const types = (trace: { type: string; index: number }[]) =>
  trace.map((e) => `${e.type}:${e.index}`);

describe('endpoint actions', () => {
  it('creates the invoice, appends it and navigates', async () => {
    const { demo, rows, pushed } = setup();
    const result = await demo.flow.run(demo.sequences.raw);
    expect(result.status).toBe('ok');
    expect(rows).toEqual([{ id: 'inv-1', customer: 'Customer 1', amount: 25, sent: false }]);
    expect(pushed).toEqual(['/invoices/inv-1']);
    expect(demo.backend.invoices()).toHaveLength(1);
  });

  it('fails on an invalid form and changes nothing', async () => {
    const { demo, rows, pushed } = setup({ invoice: { customer: '', amount: 25 } });
    const result = await demo.flow.run(demo.sequences.raw);
    expect(result.status).toBe('failed');
    expect(result.error?.error).toBeInstanceOf(HttpError);
    expect(result.error?.error).toMatchObject({
      status: 422,
      body: { message: 'Customer is required' },
    });
    expect(rows).toEqual([]);
    expect(pushed).toEqual([]);
  });
});

describe('domain actions', () => {
  it('sends the invoice when notify is ticked', async () => {
    const { demo, rows, pushed } = setup({ notify: true });
    const result = await demo.flow.run(demo.sequences.domain);
    expect(result.status).toBe('ok');
    expect(demo.backend.invoices()[0]?.sent).toBe(true);
    expect(rows).toHaveLength(1);
    expect(pushed).toEqual(['/invoices/inv-1']);
  });

  it('skips the send step when notify is off', async () => {
    const { demo, pushed } = setup({ notify: false });
    const result = await demo.flow.run(demo.sequences.domain);
    expect(result.status).toBe('ok');
    expect(types(result.trace)).toContain('step:skip:3');
    expect(demo.backend.invoices()[0]?.sent).toBe(false);
    expect(pushed).toEqual(['/invoices/inv-1']);
  });
});

describe('failing variant with rollback', () => {
  it('undoes the table row and the created invoice in reverse order', async () => {
    const { demo, rows, pushed } = setup();
    demo.backend.failSend = true;
    const { steps, rollback } = demo.variants.failing;
    const result = await demo.flow.run(steps, { rollback });
    expect(result.status).toBe('failed');
    expect(result.error).toMatchObject({ index: 3, action: 'invoices.send' });
    expect(result.error?.error).toMatchObject({ status: 500 });
    expect(rows).toEqual([]);
    expect(demo.backend.invoices()).toEqual([]);
    expect(pushed).toEqual([]);
    expect(result.trace.filter((e) => e.type === 'step:undo').map((e) => e.index)).toEqual([2, 1]);
  });

  it('leaves everything in place without rollback', async () => {
    const { demo, rows } = setup();
    demo.backend.failSend = true;
    const result = await demo.flow.run(demo.sequences.failing);
    expect(result.status).toBe('failed');
    expect(rows).toHaveLength(1);
    expect(demo.backend.invoices()).toHaveLength(1);
  });

  it('succeeds when the mail service is up', async () => {
    const { demo } = setup();
    const { steps, rollback } = demo.variants.failing;
    const result = await demo.flow.run(steps, { rollback });
    expect(result.status).toBe('ok');
  });
});

describe('demo sequences', () => {
  it('are plain JSON that passes runtime validation', () => {
    const { demo } = setup();
    for (const { steps } of Object.values(demo.variants)) {
      const json: unknown = JSON.parse(JSON.stringify(steps));
      expect(demo.flow.validate(json).ok).toBe(true);
    }
  });

  it('abort cancels an in-flight request', async () => {
    const { demo, rows } = setup({}, 200);
    const controller = new AbortController();
    const pending = demo.flow.run(demo.sequences.raw, { signal: controller.signal });
    await new Promise((r) => setTimeout(r, 20));
    controller.abort();
    const result = await pending;
    expect(result.status).toBe('aborted');
    expect(rows).toEqual([]);
    expect(demo.backend.invoices()).toEqual([]);
  });
});
