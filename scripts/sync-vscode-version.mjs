import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const vscodePkgPath = resolve('apps/vscode/package.json');
const vscode = JSON.parse(readFileSync(vscodePkgPath, 'utf8'));

if (vscode.version !== root.version) {
  vscode.version = root.version;
  writeFileSync(vscodePkgPath, JSON.stringify(vscode, null, 2) + '\n');
  console.log(`[sync-version] apps/vscode/package.json → ${root.version}`);
}
