import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('src');
const legacy = new Map([
  [
    'src/app/auth/dashboardProjectOptions.ts',
    'Dashboard option adapter wrapper; migration follows the project-option adapter scope.',
  ],
  [
    'src/app/auth/journalProjectOptions.ts',
    'Journal option adapter wrapper; migration follows the project-option adapter scope.',
  ],
  [
    'src/app/auth/milestoneProjectOptions.ts',
    'Milestone option adapter wrapper; migration follows the project-option adapter scope.',
  ],
  [
    'src/app/auth/taskProjectOptions.ts',
    'Task option adapter wrapper; migration follows the project-option adapter scope.',
  ],
  [
    'src/features/dashboard/apiStore.ts',
    'Dashboard v3 and Widget v1 queries are outside the Project pilot.',
  ],
  ['src/features/journal/apiStore.ts', 'Journal queries are outside the Project pilot.'],
  ['src/features/links/apiStore.ts', 'Link queries are outside the Project pilot.'],
  ['src/features/milestones/apiStore.ts', 'Milestone queries are outside the Project pilot.'],
  ['src/features/overview/apiStore.ts', 'Overview queries are outside the Project pilot.'],
  [
    'src/features/projects/apiStore.ts',
    'Only category-counts remains direct; Project list/detail use QueryManager.',
  ],
  [
    'src/features/projects/categoryStore.ts',
    'Category queries remain in the Category migration scope.',
  ],
  ['src/features/tasks/apiStore.ts', 'Task queries are outside the Project pilot.'],
]);

const files = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name))
      files.push(file);
  }
}
await collect(root);

const violations = [];
const found = [];
for (const file of files) {
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/');
  const source = await readFile(file, 'utf8');
  if (!/\bnew\s+Query\s*(?:<|\()/.test(source)) continue;
  if (!legacy.has(relative))
    violations.push(`${relative}: direct Query creation is not allowlisted`);
  else found.push(`${relative}: ${legacy.get(relative)}`);
}

if (violations.length) {
  console.error(['Query policy violations:', ...violations].join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Query policy passed; ${found.length} legacy exception files are explicitly tracked.`,
  );
  for (const entry of found) console.log(`- ${entry}`);
}
