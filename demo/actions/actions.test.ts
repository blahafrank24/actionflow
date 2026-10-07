import { describe, expect, it } from 'vitest';
import { formActions } from './form';
import { routerActions } from './router';
import { tableActions } from './table';

const signal = new AbortController().signal;
const invoice = { id: 'inv-1', customer: 'Customer 1', amount: 5, sent: false };

describe('demo actions', () => {
  it('form.read reads the named form', () => {
    const seen: string[] = [];
    const form = { invoice: { customer: 'Customer 1', amount: 5 }, notify: true };
    const actions = formActions((name) => {
      seen.push(name);
      return form;
    });
    expect(actions['form.read'].run({ form: 'invoice' }, { signal })).toBe(form);
    expect(seen).toEqual(['invoice']);
  });

  it('table.append appends and undoes by removing the same row', () => {
    const rows: (typeof invoice)[] = [];
    const actions = tableActions({
      invoices: {
        append: (row) => void rows.push(row),
        remove: (row) => void rows.splice(rows.indexOf(row), 1),
      },
    });
    const params = { table: 'invoices', row: invoice } as const;
    const result = actions['table.append'].run(params, { signal });
    expect(result).toBe(invoice);
    expect(rows).toEqual([invoice]);
    void actions['table.append'].undo?.(params, invoice, { signal });
    expect(rows).toEqual([]);
  });

  it('router.push awaits the navigation', async () => {
    const pushed: string[] = [];
    const actions = routerActions({
      push: async (to) => {
        await Promise.resolve();
        pushed.push(to);
      },
    });
    await actions['router.push'].run({ to: '/invoices/inv-1' }, { signal });
    expect(pushed).toEqual(['/invoices/inv-1']);
  });
});
