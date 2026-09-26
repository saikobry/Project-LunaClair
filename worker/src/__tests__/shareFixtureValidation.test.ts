/**
 * Guards the publishing contract for the committed E2E share fixtures.
 *
 * The Playwright suite serves `tests/e2e/helpers/fixtures/*.lcpack.json` from
 * mocked `/api/shares` routes, so those payloads only prove anything if they are
 * shapes the real endpoint would have accepted. The client-side freshness test
 * (`src/__tests__/e2eFixtures/`) already runs them through the stricter *client*
 * validator; this is the other half — the *Worker's* publish-time validator
 * (`validateServerStudyPackage`), which owns `pkg_*` prefix naming, relational
 * integrity, and `lc-asset://` resolution.
 *
 * It lives here rather than beside the client fixture test because the Worker is
 * the consumer of this contract and the client must not import from `worker/`;
 * the same reasoning places `aiModelCatalog.coherence.test.ts` on this side. A
 * fixture that drifts away from what the Worker accepts would otherwise be
 * discovered only by a real publish.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validateServerStudyPackage } from '../routes/shares';

const __filename = fileURLToPath(import.meta.url);
const FIXTURES_DIR = resolve(dirname(__filename), '..', '..', '..', 'tests', 'e2e', 'helpers', 'fixtures');

const fixtureFiles = readdirSync(FIXTURES_DIR)
  .filter((file) => file.endsWith('.lcpack.json'))
  .sort();

function readFixture(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as Record<string, unknown>;
}

describe('committed E2E share fixtures ↔ Worker package validator', () => {
  it('found the fixtures the E2E suite serves', () => {
    expect(fixtureFiles).toContain('cell-structure.lcpack.json');
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(2);
  });

  it.each(fixtureFiles)('%s passes validateServerStudyPackage', (file) => {
    const validation = validateServerStudyPackage(readFixture(file));

    expect(
      validation.errors,
      `${file} must satisfy the Worker publishing contract; regenerate with ` +
        '`npm run generate:e2e-fixtures` if canonical content changed.',
    ).toEqual([]);
    expect(validation.isValid).toBe(true);
  });

  it('rejects a fixture whose material id breaks the pkg_mat_ prefix (control)', () => {
    // Proves the assertion above is a live validator call, not a rubber stamp:
    // the payload is otherwise valid, so only the id prefix can fail it.
    const payload = readFixture('cell-structure.lcpack.json');
    const materials = payload.materials as Array<Record<string, unknown>>;
    const broken = { ...payload, materials: materials.map((m) => ({ ...m, id: 'bad_mat_1' })) };

    const validation = validateServerStudyPackage(broken);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.join(' ')).toContain('pkg_mat_');
  });
});
