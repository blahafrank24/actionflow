import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

export type Invoice = components['schemas']['Invoice'];
export type NewInvoice = components['schemas']['NewInvoice'];

export interface FakeBackend {
  fetch: (request: Request) => Promise<Response>;
  // When true, `POST /invoices/{id}/send` answers 500, to show a failing step and rollback.
  failSend: boolean;
  invoices(): Invoice[];
  reset(): void;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const problem = (message: string, status: number) => json({ message }, status);

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function createFakeBackend({ latencyMs = 0 }: { latencyMs?: number } = {}): FakeBackend {
  const store = new Map<string, Invoice>();
  let nextId = 1;

  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (pathname === '/invoices' && method === 'GET') {
      const sent = new URL(request.url).searchParams.get('sent');
      const all = [...store.values()];
      return json(sent === null ? all : all.filter((i) => i.sent === (sent === 'true')), 200);
    }

    if (pathname === '/invoices' && method === 'POST') {
      const body = (await request.json()) as Partial<NewInvoice>;
      if (!body.customer?.trim()) return problem('Customer is required', 422);
      if (typeof body.amount !== 'number' || body.amount <= 0) {
        return problem('Amount must be greater than 0', 422);
      }
      const invoice: Invoice = {
        id: `inv-${nextId++}`,
        customer: body.customer,
        amount: body.amount,
        sent: false,
      };
      store.set(invoice.id, invoice);
      return json(invoice, 201);
    }

    const match = /^\/invoices\/([^/]+)(\/send)?$/.exec(pathname);
    const id = decodeURIComponent(match?.[1] ?? '');
    if (!match) return problem(`No route for ${method} ${pathname}`, 404);
    const invoice = store.get(id);
    if (!invoice) return problem(`No invoice ${id}`, 404);

    if (match[2] === '/send' && method === 'POST') {
      if (backend.failSend) return problem('The mail service is down', 500);
      const sent = { ...invoice, sent: true };
      store.set(id, sent);
      return json(sent, 200);
    }
    if (method === 'GET') return json(invoice, 200);
    if (method === 'DELETE') {
      store.delete(id);
      return new Response(null, { status: 204 });
    }
    return problem(`No route for ${method} ${pathname}`, 404);
  }

  const backend: FakeBackend = {
    failSend: false,
    async fetch(request) {
      await delay(latencyMs, request.signal);
      return handle(request);
    },
    invoices: () => [...store.values()],
    reset() {
      store.clear();
      nextId = 1;
      backend.failSend = false;
    },
  };
  return backend;
}

export function createApiClient(backend: FakeBackend) {
  return createClient<paths>({ baseUrl: 'http://localhost', fetch: backend.fetch });
}
