import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const requiredHooks = ['.githooks/pre-commit', '.githooks/pre-push'];

if (process.env.CI) {
  console.log('Skipping git hook installation in CI.');
  process.exit(0);
}

for (const hook of requiredHooks) {
  if (!existsSync(hook)) {
    throw new Error(`missing required git hook: ${hook}`);
  }
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
  console.log('Git hooks installed via core.hooksPath=.githooks');
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  throw new Error(`failed to install git hooks: ${message}`);
}
