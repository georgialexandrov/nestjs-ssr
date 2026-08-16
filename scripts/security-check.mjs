import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const violations = [];

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function requireMatch(path, pattern, message) {
  if (!pattern.test(read(path))) violations.push(`${path}: ${message}`);
}

function forbidMatch(path, pattern, message) {
  if (pattern.test(read(path))) violations.push(`${path}: ${message}`);
}

for (const entry of readdirSync(join(root, '.github/workflows'), {
  withFileTypes: true,
})) {
  if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
  const path = join('.github/workflows', entry.name);
  const lines = read(path).split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const action = line.match(/\buses:\s*([^\s#]+)/)?.[1];
    if (!action || action.startsWith('./') || action.startsWith('docker://')) {
      continue;
    }
    if (!/@[0-9a-f]{40}$/i.test(action)) {
      violations.push(
        `${relative(root, join(root, path))}:${index + 1}: action must be pinned to a full commit SHA (${action})`,
      );
    }
  }

  forbidMatch(
    path,
    /\bnpx\s+[^\s]+@latest\b/i,
    'mutable @latest tool execution',
  );
}

requireMatch(
  '.github/workflows/release.yml',
  /\bid-token:\s*write\b/,
  'npm trusted publishing requires id-token: write',
);
requireMatch(
  '.github/workflows/release.yml',
  /npm publish[^\n]*--provenance/,
  'npm publishing must include provenance',
);
forbidMatch(
  '.github/workflows/release.yml',
  /\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/,
  'long-lived npm tokens are forbidden; use trusted publishing',
);

forbidMatch(
  'packages/react/src/render/vite-initializer.service.ts',
  /require\(\s*['"]express['"]\s*\)/,
  'Express must be supplied by the Nest adapter, never dynamically bundled',
);
requireMatch(
  'packages/react/tsup.config.ts',
  /['"]express['"]/,
  'Express must remain explicitly external to the package bundle',
);

for (const path of [
  'packages/react/test/integration/setup/create-fixtures.ts',
  'packages/react/test/e2e/setup/create-fixtures.ts',
]) {
  forbidMatch(
    path,
    /\bexecSync\s*\(/,
    'fixture commands must use argument arrays',
  );
  forbidMatch(
    path,
    /\bshell\s*:\s*true\b/,
    'fixture commands must not invoke a shell',
  );
}

for (const path of [
  'packages/react/src/interfaces/render-config.interface.ts',
  'docs/development.md',
  'packages/react/CLAUDE.md',
]) {
  forbidMatch(
    path,
    /\ballowRemoteClients\b/,
    'removed broad Vite proxy switch',
  );
}

const packageVersion = JSON.parse(read('packages/react/package.json')).version;
const [major, minor] = packageVersion.split('.');
requireMatch(
  'SECURITY.md',
  new RegExp(`\\b${major}\\.${minor}\\.x\\b`),
  `supported versions must include ${major}.${minor}.x`,
);

if (violations.length) {
  console.error('Security policy checks failed:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('Security policy checks passed.');
}
