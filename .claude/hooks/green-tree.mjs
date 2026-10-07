// When Claude says it's done: typecheck + tests must be green.
// If not, exit 2 keeps it working with the failure output.
// stop_hook_active stops an endless loop: on the second try, report and let it stop.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();

if (!existsSync(join(root, 'node_modules'))) process.exit(0); // dependencies not installed yet

const changed = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim();
if (!changed) process.exit(0); // nothing touched, nothing to check

try {
  execSync('npm run typecheck --silent && npm run test --silent', { cwd: root, encoding: 'utf8', stdio: 'pipe' });
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(-60).join('\n');
  if (input.stop_hook_active) process.exit(0); // already retried once; let it stop and report
  console.error(`Not done: typecheck or tests are red. Fix them before finishing.\n\n${out}`);
  process.exit(2);
}
