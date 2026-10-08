import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const quickstartPath = resolve(root, 'docs/examples/quickstart.ts');

describe('README', () => {
  it('quotes docs/examples/quickstart.ts exactly', () => {
    const quoted = /<!-- quickstart -->\s*```ts\n([\s\S]*?)```/.exec(readme)?.[1];
    expect(quoted).toBeDefined();
    expect(quoted?.trimEnd()).toBe(readFileSync(quickstartPath, 'utf8').trimEnd());
  });

  it('has an example that runs and ends ok', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await import(quickstartPath);
    expect(log.mock.calls).toEqual([['navigate to', '/invoices/inv-1'], ['ok']]);
    log.mockRestore();
  });

  it('uses absolute links, so it renders on the npm page', () => {
    const links = [...readme.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1] ?? '');
    const relative = links.filter((href) => !/^(https?:\/\/|#)/.test(href));
    expect(relative).toEqual([]);
  });
});
