import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('src');
const allowedLayers = {
  app: new Set(['app', 'pages', 'features', 'shared']),
  pages: new Set(['pages', 'features', 'shared']),
  features: new Set(['features', 'shared']),
  shared: new Set(['shared']),
};
// Explicit project contracts are shared intentionally; other features stay independent.
const projectContracts = new Set([
  'categoryFilter.ts',
  'CategoryFilterControl.tsx',
  'ProjectFilter.tsx',
  'scope.ts',
  'model.ts',
  'ProjectsProvider.tsx',
  'ProjectSelect.tsx',
]);
const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (configFile.error)
  throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
const files = readdirSync(root, { recursive: true }).filter((file) => /\.tsx?$/.test(file));
const errors = [];
let count = 0;

for (const name of files) {
  const file = path.join(root, name);
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const [layer, feature] = name.split(path.sep);
  const check = (specifier) => {
    const target = ts.resolveModuleName(
      specifier.text,
      file,
      config.options,
      ts.sys,
    ).resolvedModule;
    if (!target || target.isExternalLibraryImport) return;
    const relative = path.relative(root, target.resolvedFileName).replaceAll('\\', '/');
    const [targetLayer, targetFeature, ...rest] = relative.split('/');
    const location = source.getLineAndCharacterOfPosition(specifier.getStart(source));
    const report = (reason) =>
      errors.push(`${name}:${location.line + 1}: ${reason}: ${specifier.text}`);
    count++;
    if (name === 'main.tsx') return;
    if (!allowedLayers[layer]?.has(targetLayer)) {
      report('Forbidden layer dependency');
    } else if (layer === 'features' && targetLayer === 'features' && feature !== targetFeature) {
      const module = rest.join('/');
      const fixtureConsumer = name.endsWith('.test.ts') || name.endsWith(`${path.sep}fixtures.ts`);
      if (
        targetFeature !== 'projects' ||
        !(projectContracts.has(module) || (module === 'fixtures.ts' && fixtureConsumer))
      ) {
        report('Undeclared cross-feature dependency');
      }
    }
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      check(node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      check(node.argument.literal);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) check(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Source boundaries pass: ${files.length} files, ${count} local imports.`);
}
