import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) files.push(...walk(path));
    else if (path.endsWith('.js') || path.endsWith('.mjs')) files.push(path);
  }
  return files;
}

const files = [
  'sw.js',
  ...walk('js'),
  ...walk('vendor/firebase'),
  ...walk('scripts')
];

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

for (const file of ['manifest.json', 'package.json']) {
  JSON.parse(readFileSync(file, 'utf8'));
}

console.log(`Sintaxis correcta en ${files.length} archivos JavaScript y 2 archivos JSON.`);
