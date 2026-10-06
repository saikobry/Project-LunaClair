import { describe, it, expect } from 'vitest';
import { resolve, dirname, join, posix } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Architecture: DOX (AGENTS.md) Consistency
 *
 * Enforces the root `AGENTS.md` "Single-Source Rules" against the whole DOX tree.
 * Five defects that shipped in this corpus motivated each check — a documented
 * file that did not exist, a documented directory that did not exist, a symbol
 * cited as live after it was removed, a duplicated bullet, and a stale pass count.
 *
 * Docs are contracts: a false one sends the next reader to a file or symbol that
 * is not there. These checks are mechanical, so they belong in a test rather than
 * in a reviewer's memory. See `docs/architecture/` for the doc axis.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../..');

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dev-dist', 'coverage', 'test-results',
  'playwright-report', '.git', '.react-doctor',
  // Agent and tooling state, not project artifacts: walking it is slow, nothing
  // documents it, and a directory mid-write can vanish under a concurrent run.
  '.kilo', '.freebuff', '.orchestrator', '.wrangler',
]);

/** Path-shaped roots a DOX file may express a reference relative to. */
const REFERENCE_ROOTS = [
  '', 'src', 'src/application', 'src/features', 'src/app', 'src/shared',
  'worker', 'worker/src', 'scripts', 'tests', 'tests/e2e', 'content',
];

const EXTENSION_CANDIDATES = [
  '', '.ts', '.tsx', '.mjs', '.js', '.json', '.css', '.sql',
  '.spec.ts', '.spec.tsx', '/index.ts', '/index.tsx',
];

/** Oxlint plugin namespaces — a rule id (`react/rules-of-hooks`) is not a path. */
const LINT_PLUGIN_NAMESPACES = new Set(['react', 'typescript', 'oxc', 'react-doctor']);

/** Build outputs that legitimately do not exist until a build runs. */
const BUILD_OUTPUTS = new Set(['dist', 'dist-ssr', 'coverage', 'dev-dist']);

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|sql|json|css|ps1)$/;
const KNOWN_FILE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|sql|md|ps1|svg|html|png|txt|lcpack)$/i;

/** A package name like `tesseract.js` reads as a filename but is a dependency. */
const DEPENDENCY_NAMES: Set<string> = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    return new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
  } catch {
    return new Set<string>();
  }
})();

/**
 * Words in a single bullet or table cell before it stops reading in one screen.
 * 300 is the recorded violation bar (the "still violating" tier in the DOX audit);
 * 120 would flag the moderate tier as well, which is not yet a defect.
 */
const OVERSIZED_LINE_WORDS = 300;

/**
 * Recorded oversized-line debt, per file: a file may not GAIN oversized lines.
 * This is a no-growth ceiling, not a target — lowering a number here as docs are
 * split is the intended direction of travel, and any file absent from this map
 * is held to zero. Do not add an entry to silence a new violation; split the rule.
 */
const OVERSIZED_LINE_DEBT: Record<string, number> = {
  'src/app/AGENTS.md': 1,
  'src/features/ai/AGENTS.md': 2,
  'src/features/importer/AGENTS.md': 1,
  'src/features/materials/AGENTS.md': 1,
  'src/infrastructure/AGENTS.md': 1,
};

/**
 * Documented references that legitimately do not resolve, each with a reason.
 * Mirrors the repo's `.react-doctor/false-positives.md` practice: the record is
 * reviewable, every entry names why, and the check stays strict on everything else.
 * A removal is prose a doc may carry (it stops the thing being reintroduced); what
 * is forbidden is citing something that does not exist as though it were live.
 */
const KNOWN_NON_RESOLVING: Record<string, string> = {
  'features/analytics/AnalyticsScreen':
    'docs assert this module does NOT exist ("There is no ... module to import") — the negation is the contract',
  'features/ai/generator/components/AiFlashcardGeneratorDialog':
    'documented removal — the dialog was retired and naming it prevents reintroduction',
  'AiFlashcardGeneratorDialog': 'documented removal (see above)',
  'documents.ts': 'documented removal — the retired Worker route handlers',
  'figures.ts': 'documented removal — the retired Worker route handlers',
  'testMatch': "Playwright's own config key, not a project symbol",
};

/** A doc may say a thing was removed; it may not say a removed thing still exists. */
const REMOVAL_FRAMING = /\b(removed|deleted|retired|dropped|no longer|there is no|not exist|former|vestige|gone|unused|unconsumed|no manual|would add|no meaningful|do not add|belongs to the deleted)\b/i;

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function collectDoxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = posix.join(...abs.slice(REPO_ROOT.length + 1).split(/[\\/]/));
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      collectDoxFiles(abs, out);
    } else if (entry.name === 'AGENTS.md') {
      out.push(rel);
    }
  }
  return out;
}

function collectRepoFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = posix.join(...abs.slice(REPO_ROOT.length + 1).split(/[\\/]/));
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(rel + '/');
      collectRepoFiles(abs, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

const DOX_FILES = collectDoxFiles(REPO_ROOT).sort();
const REPO_FILES = collectRepoFiles(REPO_ROOT);
const REPO_FILE_SET = new Set(REPO_FILES);
const REPO_BASENAMES = new Set(REPO_FILES.map((f) => f.replace(/\/$/, '').split('/').pop()!));
/** Every repo path with its extension stripped, for extension-insensitive refs. */
const REPO_PATH_STEMS = new Set(
  REPO_FILES.filter((f) => !f.endsWith('/')).map((f) => f.replace(/\.[^./]+$/, '')),
);
/**
 * Authored project code — where a documented symbol must actually live. A symbol
 * found only in an agent transcript or a build artifact is not evidence that the
 * symbol exists, so the index covers the real source roots plus root-level configs.
 */
const SOURCE_ROOTS = ['src', 'worker', 'scripts', 'tests', 'content', 'functions'];

const isSourceFile = (rel: string): boolean =>
  SOURCE_EXT.test(rel)
  && !rel.endsWith('-lock.json')
  && (rel.includes('/') ? SOURCE_ROOTS.some((root) => rel.startsWith(root + '/')) : true);

/**
 * A read failure must not silently shrink the index: a file read as empty looks
 * exactly like a symbol that does not exist, so a transient I/O fault would be
 * reported as a phantom symbol. Reads are retried, and any file still unreadable
 * is recorded so the check can say it was inconclusive rather than wrong.
 */
const SOURCE_READ_FAILURES: string[] = [];

function readSource(rel: string): string {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return readFileSync(join(REPO_ROOT, rel), 'utf8');
    } catch {
      // Transient on Windows when many workers touch the same tree; retry.
    }
  }
  SOURCE_READ_FAILURES.push(rel);
  return '';
}

const SOURCE_TEXT = REPO_FILES.filter(isSourceFile).map(readSource).join('\n');

const readDox = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');
const linesOf = (raw: string) => raw.split('\r').join('').split('\n');

function backtickedTokens(raw: string): string[] {
  return [...raw.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
}

// ---------------------------------------------------------------------------
// Check 1 — every referenced path exists
// ---------------------------------------------------------------------------

function looksLikePath(token: string): boolean {
  if (!token || token.length < 3 || token.length > 200) return false;
  if (token.startsWith('/')) return false;              // an app route
  if (token.includes('://') || token.includes('+')) return false;
  if (token.startsWith('.')) return false;              // a bare extension mention
  if (/^(--|var\(|@media|@)/.test(token)) return false;
  if (/^(npm|npx|node|wrangler|tsc|vite|vitest)\b/.test(token)) return false;
  if (/^[a-z]+:[a-z:]+$/.test(token)) return false;     // an npm script name
  if (token.includes(' ')) return false;                // a prose phrase
  if (/[()<>[\]]/.test(token)) return false;            // or an indexed access
  if (token.startsWith('**') || token.endsWith('**')) return false;
  if (token.includes('*')) return false;                // a glob, not a path
  if (DEPENDENCY_NAMES.has(token)) return false;        // an npm dependency
  const namespace = token.split('/')[0];
  if (LINT_PLUGIN_NAMESPACES.has(namespace)) return false; // a lint rule id
  const head = token.replace(/\/+$/, '').split('/')[0];
  if (BUILD_OUTPUTS.has(head)) return false;            // a build artifact
  if (!token.includes('/') && !KNOWN_FILE_EXT.test(token)) return false;
  return true;
}

function tokenResolves(docDir: string, token: string): boolean {
  let clean = token.replace(/[.,;:)]+$/, '');
  if (clean.startsWith('./')) clean = clean.slice(2);
  clean = clean.replace(/\/+$/, '');
  if (!clean) return true;

  const roots = new Set<string>([docDir, ...REFERENCE_ROOTS]);
  // A doc may reference a sibling subtree, so walk up from its own directory too.
  let ancestor = docDir;
  for (let i = 0; i < 3 && ancestor; i += 1) {
    ancestor = posix.dirname(ancestor);
    if (ancestor && ancestor !== '.' && ancestor !== '/') roots.add(ancestor);
  }
  for (const r of roots) {
    for (const ext of EXTENSION_CANDIDATES) {
      const candidate = posix.normalize((r ? r + '/' : '') + clean + ext).replace(/\/+$/, '');
      if (!candidate || candidate === '.') continue;
      if (REPO_FILE_SET.has(candidate) || REPO_FILE_SET.has(candidate + '/')) return true;
    }
  }
  // A bare filename anywhere in the repo, or any path suffix match.
  if (REPO_FILES.some((f) => f === clean || f.endsWith('/' + clean) || f.startsWith(clean + '/'))) return true;
  // The same match ignoring extensions: `hooks/useVisitedTabs` vs `.../useVisitedTabs.ts`.
  if (REPO_PATH_STEMS.has(clean)) return true;
  if ([...REPO_PATH_STEMS].some((stem) => stem.endsWith('/' + clean))) return true;
  return REPO_BASENAMES.has(clean.split('/').pop()!);
}

// ---------------------------------------------------------------------------
// Check 4 — no symbol cited as live while absent from source
// ---------------------------------------------------------------------------

function looksLikeSymbol(token: string): boolean {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) return false;
  if (token.length < 6) return false;
  return /^[a-z]+[A-Z]/.test(token)   // camelCase
    || /^[A-Z][a-z]/.test(token)      // PascalCase
    || /^[A-Z][A-Z0-9_]{3,}$/.test(token); // CONSTANT_CASE
}

/** The line the token sits on is the removal's own sentence in this corpus. */
function lineOfToken(raw: string, token: string): string {
  return linesOf(raw).find((l) => l.includes('`' + token + '`')) ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Architecture: DOX (AGENTS.md) Consistency', () => {
  it('discovers the DOX tree', () => {
    expect(DOX_FILES.length).toBeGreaterThan(20);
    expect(DOX_FILES).toContain('AGENTS.md');
  });

  it('every path a DOX file names exists on disk', () => {
    const violations: string[] = [];

    for (const doc of DOX_FILES) {
      const raw = readDox(doc);
      const docDir = posix.dirname(doc) === '.' ? '' : posix.dirname(doc);
      const seen = new Set<string>();

      for (const token of backtickedTokens(raw)) {
        if (!looksLikePath(token) || seen.has(token)) continue;
        seen.add(token);
        if (KNOWN_NON_RESOLVING[token]) continue;
        if (!tokenResolves(docDir, token)) {
          violations.push(`  ${doc} — \`${token}\` does not exist`);
        }
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `DOX files reference ${violations.length} path(s) that are not on disk.\n` +
        `Either fix the path, or delete the reference; a doc may describe a removal but must not cite a phantom as live:\n` +
        violations.join('\n'),
      );
    }
  });

  it('no DOX file repeats a bullet verbatim', () => {
    const violations: string[] = [];

    for (const doc of DOX_FILES) {
      const bullets = new Map<string, number[]>();
      linesOf(readDox(doc)).forEach((line, index) => {
        const match = line.match(/^ *(?:[-*]|[0-9]+\.) +(.*)$/);
        if (!match) return;
        const normalized = match[1].split(' ').filter(Boolean).join(' ').trim().toLowerCase();
        if (normalized.length < 40) return;
        bullets.set(normalized, [...(bullets.get(normalized) ?? []), index + 1]);
      });
      for (const [text, at] of bullets) {
        if (at.length > 1) {
          violations.push(`  ${doc} lines ${at.join(', ')} — "${text.slice(0, 80)}…"`);
        }
      }
    }

    if (violations.length > 0) {
      expect.fail(`DOX files repeat a bullet verbatim (one rule, one owning statement):\n${violations.join('\n')}`);
    }
  });

  it('no DOX file has a broken list nesting jump', () => {
    const violations: string[] = [];

    for (const doc of DOX_FILES) {
      let previous: number | null = null;
      linesOf(readDox(doc)).forEach((line, index) => {
        const match = line.match(/^( *)(?:[-*]|[0-9]+\.) /);
        if (!match) return;
        const indent = match[1].length;
        if (previous !== null && indent > previous + 2) {
          violations.push(`  ${doc}:${index + 1} — indent ${previous} → ${indent}`);
        }
        previous = indent;
      });
    }

    if (violations.length > 0) {
      expect.fail(`DOX files jump list indentation by more than one level:\n${violations.join('\n')}`);
    }
  });

  it('never cites a symbol as live when it is absent from source', () => {
    if (SOURCE_READ_FAILURES.length > 0) {
      expect.fail(
        `The source index is incomplete — ${SOURCE_READ_FAILURES.length} file(s) could not be read, ` +
        `so nothing can be claimed about symbols they may hold:\n` +
        SOURCE_READ_FAILURES.slice(0, 20).map((f) => `  ${f}`).join('\n'),
      );
    }

    const violations: string[] = [];

    for (const doc of DOX_FILES) {
      const raw = readDox(doc);
      const seen = new Set<string>();

      for (const token of backtickedTokens(raw)) {
        if (!looksLikeSymbol(token) || seen.has(token)) continue;
        seen.add(token);
        if (KNOWN_NON_RESOLVING[token]) continue;
        if (SOURCE_TEXT.includes(token)) continue;
        // A removal is allowed to name what it removed; a live claim is not.
        if (REMOVAL_FRAMING.test(lineOfToken(raw, token))) continue;
        violations.push(`  ${doc} — \`${token}\` is cited as live but appears nowhere in source`);
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `DOX files cite ${violations.length} symbol(s) that do not exist in source.\n` +
        `Fix the name, or state that it was removed:\n${violations.join('\n')}`,
      );
    }
  });

  it('does not grow the oversized-line debt (root Single-Source Rules)', () => {
    const violations: string[] = [];

    for (const doc of DOX_FILES) {
      const oversized = linesOf(readDox(doc))
        .filter((line) => line.trim().split(/\s+/).filter(Boolean).length > OVERSIZED_LINE_WORDS)
        .length;
      const allowed = OVERSIZED_LINE_DEBT[doc] ?? 0;
      if (oversized > allowed) {
        violations.push(
          `  ${doc} — ${oversized} line(s) over ${OVERSIZED_LINE_WORDS} words, ceiling is ${allowed}`,
        );
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `A bullet or table cell must read in one screen. Split the rule into named sub-rules — ` +
        `do not raise the ceiling:\n${violations.join('\n')}`,
      );
    }
  });

  it('has no stale debt entry for a file that no longer exceeds its ceiling', () => {
    // Keeps the debt map honest as docs are split: a stale entry is not harmless,
    // it is unused headroom that lets the file grow back without failing.
    const stale = Object.entries(OVERSIZED_LINE_DEBT)
      .filter(([doc, ceiling]) => {
        if (!DOX_FILES.includes(doc)) return true;
        const oversized = linesOf(readDox(doc))
          .filter((line) => line.trim().split(/\s+/).filter(Boolean).length > OVERSIZED_LINE_WORDS)
          .length;
        return oversized < ceiling;
      })
      .map(([doc, ceiling]) => `  ${doc} — ceiling ${ceiling} is above the current count; lower it`);

    if (stale.length > 0) {
      expect.fail(`Recorded oversized-line debt is stale:\n${stale.join('\n')}`);
    }
  });
});
