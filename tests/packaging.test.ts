import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const work = mkdtempSync(join(tmpdir(), 'actionflow-pack-'));

// An unresolvable import inside the published .d.ts turns every type into `any`,
// so the @ts-expect-error below goes unused and tsc fails.
const consumer = `
import { action, createFlow } from 'actionflow';
import { apiActions } from 'actionflow/openapi';

const flow = createFlow({ 'a.one': action(() => ({ id: 'x' })) });
flow.defineSequence([{ action: 'a.one', as: 'o' }]);
// @ts-expect-error the published types must still reject an unknown action
flow.defineSequence([{ action: 'a.two' }]);
export { apiActions };
`;

beforeAll(() => {
  const pkg = join(work, 'node_modules', 'actionflow');
  mkdirSync(pkg, { recursive: true });
  const vite = join(root, 'node_modules/vite/bin/vite.js');
  execFileSync(process.execPath, [vite, 'build', '--outDir', join(pkg, 'dist'), '--emptyOutDir'], {
    cwd: root,
    stdio: 'pipe',
  });
  cpSync(join(root, 'package.json'), join(pkg, 'package.json'));
  symlinkSync(
    join(root, 'node_modules/openapi-fetch'),
    join(work, 'node_modules/openapi-fetch'),
    'dir',
  );
  writeFileSync(join(work, 'package.json'), '{ "type": "module" }');
  writeFileSync(join(work, 'check.ts'), consumer);
}, 120_000);

afterAll(() => rmSync(work, { recursive: true, force: true }));

const typecheck = (module: string, moduleResolution: string) => {
  const tsc = join(root, 'node_modules/typescript/bin/tsc');
  const args = ['--noEmit', '--strict', '--target', 'es2022'];
  args.push('--module', module, '--moduleResolution', moduleResolution, 'check.ts');
  const result = spawnSync(process.execPath, [tsc, ...args], { cwd: work, encoding: 'utf8' });
  return result.stdout + result.stderr;
};

describe('published package', () => {
  it('keeps its types under moduleResolution nodenext', () => {
    expect(typecheck('nodenext', 'nodenext')).toBe('');
  });

  it('keeps its types under moduleResolution bundler', () => {
    expect(typecheck('esnext', 'bundler')).toBe('');
  });
});
