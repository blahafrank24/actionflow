import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: import.meta.dirname + '/..' });

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).flatMap((m) => (m.ruleId ? [m.ruleId] : []));
}

describe('boundary rules', () => {
  it('rejects UI framework imports in core', async () => {
    expect(
      await ruleIds('src/core/x.ts', `import { ref } from 'vue';\nexport const r = ref;\n`),
    ).toContain('no-restricted-imports');
  });

  it('rejects openapi-fetch imports in core', async () => {
    expect(
      await ruleIds(
        'src/core/x.ts',
        `import createClient from 'openapi-fetch';\nexport const c = createClient;\n`,
      ),
    ).toContain('no-restricted-imports');
  });

  it('rejects core importing the openapi entry', async () => {
    expect(await ruleIds('src/core/x.ts', `export * from '../openapi';\n`)).toContain(
      'no-restricted-imports',
    );
  });

  it('rejects UI framework imports in openapi', async () => {
    expect(
      await ruleIds('src/openapi/x.ts', `import { ref } from 'vue';\nexport const r = ref;\n`),
    ).toContain('no-restricted-imports');
  });

  it('rejects library code importing the demo', async () => {
    expect(await ruleIds('src/openapi/x.ts', `export * from '../../demo/main';\n`)).toContain(
      'no-restricted-imports',
    );
  });

  it('rejects fetch in src', async () => {
    expect(await ruleIds('src/openapi/x.ts', `export const f = () => fetch('/x');\n`)).toContain(
      'no-restricted-globals',
    );
  });

  it('rejects fetch in the demo outside demo/api', async () => {
    expect(await ruleIds('demo/actions/x.ts', `export const f = () => fetch('/x');\n`)).toContain(
      'no-restricted-globals',
    );
  });

  it('allows fetch in demo/api', async () => {
    expect(await ruleIds('demo/api/x.ts', `export const f = () => fetch('/x');\n`)).toEqual([]);
  });
});
