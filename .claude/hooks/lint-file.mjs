// After every file edit: format and lint just that file.
// Exit 2 sends the output back to Claude so it fixes the problem itself.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();

if (!file || !/\.(ts|vue|js|mjs)$/.test(file)) process.exit(0);
if (!existsSync(join(root, 'node_modules'))) process.exit(0); // dependencies not installed yet

const rel = relative(root, file);
const run = (bin, args) =>
  execFileSync(join(root, 'node_modules', '.bin', bin), args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });

try {
  run('prettier', ['--write', '--log-level', 'warn', rel]);
  run('eslint', ['--fix', '--no-warn-ignored', rel]);
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
  console.error(`Lint failed for ${rel}. Fix the cause; don't disable the rule.\n\n${out}`);
  process.exit(2);
}
