import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const files = [
  'README.md',
  ...readdirSync('docs', { recursive: true })
    .filter((file) => file.endsWith('.md'))
    .map((file) => join('docs', file)),
];
const errors = [];
for (const file of files) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1].split('#')[0];
    if (link && !/^[a-z]+:/.test(link) && !existsSync(resolve(dirname(file), link))) {
      errors.push(`${file}: ${link}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Markdown links resolve in ${files.length} documents.`);
}
