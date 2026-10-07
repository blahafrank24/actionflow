# actionflow

Typed, serializable action sequences for UI apps.

> **Status:** early development. The API below is the target design, and nothing is published yet. See [docs/PLAN.md](docs/PLAN.md).

UI handlers keep doing the same few things: read a form, call an API, update a table, navigate. `actionflow` describes them as **data** and runs them against a registry of typed actions:

```ts
const submitInvoice = flow.defineSequence([
  { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
  { action: 'api:POST /invoices', params: { body: '$draft' }, as: 'created' },
  { action: 'table.append', params: { table: 'invoices', row: '$created' } },
  { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
]);
```

- **Typed end to end:** action names, params, refs between steps, and OpenAPI request and response types.
- **Serializable:** sequences are plain JSON, so they can come from config or a server, with runtime validation.
- **Observable:** every run produces a trace (resolved params, results, timings, skips, errors, undo).
- **No UI framework dependency:** zero runtime dependencies, plus an optional `actionflow/openapi` entry.

`actionflow` is the action layer of **vue-schema-admin**, a config-driven Vue 3 admin framework that's in development and not yet public. It's published as a standalone package: it has no UI framework dependency. The Vue side lives in the framework, and the demo shows how little a UI integration takes.

Design and trade-offs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). How it was built with an AI agent: [AI-LOG.md](AI-LOG.md).

## License

MIT
