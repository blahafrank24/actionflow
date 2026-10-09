import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createMemoryHistory } from 'vue-router';
import App from './App.vue';
import { appKey, createAppContext } from './appContext';
import { createDemoRouter } from './router';

const mounted: { app: ReturnType<typeof createApp>; el: HTMLElement }[] = [];

async function mountApp(latencyMs = 0) {
  const router = createDemoRouter(createMemoryHistory());
  const ctx = createAppContext(router, { latencyMs });
  const el = document.createElement('div');
  document.body.append(el);
  const app = createApp(App).use(router).provide(appKey, ctx);
  await router.push('/');
  await router.isReady();
  app.mount(el);
  mounted.push({ app, el });
  return { el, router, ctx };
}

afterEach(() => {
  mounted.splice(0).forEach(({ app, el }) => {
    app.unmount();
    el.remove();
  });
});

const button = (el: HTMLElement, name: string) => {
  const found = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  if (!found) throw new Error(`No button "${name}"`);
  return found;
};

function type(el: HTMLElement, name: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(`input[name=${name}]`);
  if (!input) throw new Error(`No input ${name}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function pick(el: HTMLElement, label: string) {
  const radio = [...el.querySelectorAll<HTMLInputElement>('input[name=variant]')].find((r) =>
    r.parentElement?.textContent?.includes(label),
  );
  if (!radio) throw new Error(`No variant "${label}"`);
  radio.click();
}

const statuses = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>('li.step')].map((li) => li.dataset.status);
const runStatus = (el: HTMLElement) => el.querySelector('[role=status]')?.textContent?.trim();
const rows = (el: HTMLElement) => [...el.querySelectorAll('tbody tr')].map((tr) => tr.textContent);

describe('demo app', () => {
  it('starts idle with pending steps and an empty table', async () => {
    const { el } = await mountApp();
    expect(runStatus(el)).toBe('Ready');
    expect(statuses(el)).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(el.textContent).toContain('No invoices yet');
    expect(button(el, 'Abort').disabled).toBe(true);
  });

  it('shows the selected sequence as JSON', async () => {
    const { el } = await mountApp();
    const json = el.querySelector('.json pre')?.textContent ?? '';
    expect(JSON.parse(json)[1]).toMatchObject({ action: 'api:POST /invoices' });
    pick(el, 'Domain actions');
    await vi.waitFor(() =>
      expect(el.querySelector('.json pre')?.textContent).toContain('invoices.create'),
    );
  });

  it('runs the endpoint variant: row added, trace done, navigated to the detail page', async () => {
    const { el, router } = await mountApp();
    type(el, 'customer', 'Customer 7');
    type(el, 'amount', '42');
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    expect(statuses(el)).toEqual(['done', 'done', 'done', 'done']);
    expect(router.currentRoute.value.fullPath).toBe('/invoices/inv-1');
    await vi.waitFor(() => expect(el.querySelector('.facts')?.textContent).toContain('42'));
    expect(el.textContent).toContain('Customer 7');
    expect(el.querySelector('#detail-title')?.textContent).toBe('Invoice inv-1');
  });

  it('lists the created invoices on the home route', async () => {
    const { el, router } = await mountApp();
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    await router.push('/');
    await vi.waitFor(() => expect(rows(el)).toHaveLength(1));
    expect(rows(el)[0]).toContain('Customer 1');
    expect(el.querySelector('tbody a')?.getAttribute('href')).toBe('/invoices/inv-1');
  });

  it('keeps the trace on screen when the sequence navigates', async () => {
    const { el } = await mountApp();
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    expect(el.querySelector('#trace-title')).not.toBeNull();
    expect(el.querySelectorAll('li.step')).toHaveLength(4);
  });

  it('skips the send step when notify is off, in the domain variant', async () => {
    const { el, ctx } = await mountApp();
    pick(el, 'Domain actions');
    const notify = el.querySelector<HTMLInputElement>('input[name=notify]');
    notify?.click();
    await vi.waitFor(() => expect(ctx.form.notify).toBe(false));
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    expect(statuses(el)).toEqual(['done', 'done', 'done', 'skipped', 'done']);
    expect(ctx.demo.backend.invoices()[0]?.sent).toBe(false);
  });

  it('runs the send step when notify is on', async () => {
    const { el, ctx } = await mountApp();
    pick(el, 'Domain actions');
    await vi.waitFor(() => expect(statuses(el)).toHaveLength(5));
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    expect(statuses(el)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(ctx.demo.backend.invoices()[0]?.sent).toBe(true);
  });

  it('fails the third variant and rolls back the row and the invoice', async () => {
    const { el, ctx, router } = await mountApp();
    pick(el, 'Failing send');
    await vi.waitFor(() => expect(el.textContent).toContain('mail service is down'));
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Failed'));
    expect(statuses(el)).toEqual(['done', 'done', 'done', 'error', 'pending']);
    const items = [...el.querySelectorAll<HTMLElement>('li.step')];
    expect(items.map((li) => li.dataset.undo)).toEqual([
      undefined,
      'undone',
      'undone',
      undefined,
      undefined,
    ]);
    expect(items[3]?.textContent).toContain('failed with 500');
    expect(items[4]?.querySelector('.badge')?.textContent?.trim()).toBe('not run');
    expect(ctx.rows.value).toEqual([]);
    expect(ctx.demo.backend.invoices()).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe('/');
  });

  it('fails on an invalid form with the server problem in the trace', async () => {
    const { el, ctx } = await mountApp();
    type(el, 'customer', '');
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Failed'));
    expect(statuses(el)).toEqual(['done', 'error', 'pending', 'pending']);
    expect(el.textContent).toContain('Customer is required');
    expect(ctx.rows.value).toEqual([]);
  });

  it('disables the controls while running and aborts an in-flight request', async () => {
    const { el, ctx } = await mountApp(300);
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Running…'));
    expect(button(el, 'Run').disabled).toBe(true);
    expect(button(el, 'Reset').disabled).toBe(true);
    expect(el.querySelector<HTMLInputElement>('input[name=customer]')?.disabled).toBe(true);
    expect(el.querySelector('fieldset')?.disabled).toBe(true);
    button(el, 'Abort').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Aborted'));
    expect(ctx.demo.backend.invoices()).toEqual([]);
    expect(button(el, 'Run').disabled).toBe(false);
  });

  it('clears the previous trace when another variant is picked', async () => {
    const { el } = await mountApp();
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    pick(el, 'Domain actions');
    await vi.waitFor(() => expect(runStatus(el)).toBe('Ready'));
    expect(statuses(el)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
  });

  it('resets the table, the backend and the trace', async () => {
    const { el, ctx, router } = await mountApp();
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    button(el, 'Reset').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Ready'));
    expect(ctx.rows.value).toEqual([]);
    expect(ctx.demo.backend.invoices()).toEqual([]);
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/'));
  });

  it('shows a not-found state for an unknown invoice', async () => {
    const { el, router } = await mountApp();
    await router.push('/invoices/nope');
    await vi.waitFor(() => expect(el.textContent).toContain('No such invoice'));
  });

  it('does not change a finished trace when the form is edited afterwards', async () => {
    const { el } = await mountApp();
    type(el, 'customer', 'Before');
    button(el, 'Run').click();
    await vi.waitFor(() => expect(runStatus(el)).toBe('Succeeded'));
    const before = el.querySelector('.trace')?.textContent;
    type(el, 'customer', 'After');
    await Promise.resolve();
    expect(el.querySelector('.trace')?.textContent).toBe(before);
    expect(before).toContain('Before');
  });
});
