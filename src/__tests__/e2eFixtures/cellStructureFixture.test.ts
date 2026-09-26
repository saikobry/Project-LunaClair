import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validateStudyPackage } from '../../domain/package/engines/validateStudyPackage';
import {
  E2E_FIXTURE_CREATED_AT,
  buildE2EShareFixture,
  getE2EShareFixture,
} from '../../../scripts/lib/e2eShareFixtures.mjs';
import { resolveMaterialDir } from '../../../scripts/lib/studyPackageBuilder.mjs';

/**
 * Contract for the committed E2E share fixtures (`tests/e2e/helpers/fixtures/`).
 *
 * The Playwright suite serves these payloads from mocked `/api/shares` routes, so
 * two things must hold forever:
 *   1. each payload passes the strict client validator the clone path runs, and
 *   2. each payload still equals what the pure builder produces from today's
 *      canonical content — otherwise a content or builder edit would leave the
 *      suite silently testing yesterday's library.
 *
 * Regenerate with `npm run generate:e2e-fixtures` when this fails legitimately.
 *
 * Uses `node:fs`, so the folder is excluded from `tsconfig.app.json` alongside
 * `src/__tests__/architecture` (that config carries only `vite/client` types).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../../..');
const FIXTURES_DIR = resolve(ROOT_DIR, 'tests', 'e2e', 'helpers', 'fixtures');
const MATERIALS_DIR = resolve(ROOT_DIR, 'content', 'materials');

interface FixturePayload {
  format: string;
  schemaVersion: number;
  metadata: { title: string; description?: string; author?: string; createdAt: string };
  materials: Array<{ id: string; title: string; documentContent: string; tags?: string[]; order?: number }>;
  questions: Array<{ id: string; materialId: string; prompt: string }>;
  quizzes: Array<{
    id: string;
    title: string;
    materialId: string;
    items: Array<{ questionId: string; order: number }>;
  }>;
  assets?: Array<{ id: string }>;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readCommittedFixture(fixtureKey = 'cellStructure'): FixturePayload {
  const fixtureSpec = getE2EShareFixture(fixtureKey);
  return readJson(join(FIXTURES_DIR, fixtureSpec.fixtureFile)) as FixturePayload;
}

/**
 * Regenerates the payload the way `scripts/generate-e2e-fixtures.mjs` does. The
 * file reads are mirrored here rather than shared, because the freshness
 * assertion below is a full deep-compare: any divergence in inputs or order
 * surfaces as a failure rather than passing quietly.
 */
function regenerateFixture(fixtureKey = 'cellStructure'): FixturePayload {
  const fixtureSpec = getE2EShareFixture(fixtureKey);
  const catalog = readJson(resolve(ROOT_DIR, 'content', 'catalog', 'materials.json')) as Array<
    Record<string, unknown> & { id: string }
  >;
  const questions = readJson(resolve(ROOT_DIR, 'content', 'quiz', 'questions.json'));
  const quizzes = readJson(resolve(ROOT_DIR, 'content', 'quiz', 'quizzes.json'));

  const material = catalog.find((entry) => entry.id === fixtureSpec.materialId);
  if (!material) {
    throw new Error(`No catalog entry with id "${fixtureSpec.materialId}".`);
  }

  const dirPath = resolve(MATERIALS_DIR, resolveMaterialDir(material));
  const markdown = readFileSync(resolve(dirPath, 'index.md'), 'utf8');

  const imagesDir = resolve(dirPath, 'images');
  const assets = existsSync(imagesDir)
    ? readdirSync(imagesDir).map((filename) => ({
        filename,
        dataBase64: readFileSync(resolve(imagesDir, filename)).toString('base64'),
      }))
    : [];

  const result = buildE2EShareFixture({ material, markdown, assets, questions, quizzes });
  return result.payload as FixturePayload;
}

describe('E2E share fixture: cellStructure', () => {
  it('produces a payload the strict client clone validator accepts', () => {
    const payload = readCommittedFixture();
    const validation = validateStudyPackage(payload);

    expect(
      validation.errors,
      'Committed fixture must pass validateStudyPackage; regenerate with `npm run generate:e2e-fixtures`.',
    ).toEqual([]);
    expect(validation.isValid).toBe(true);
  });

  it('still equals a fresh build from canonical content', () => {
    const committed = readCommittedFixture();
    const regenerated = regenerateFixture();

    expect(
      regenerated,
      'Committed fixture drifted from canonical content or the pure builder. ' +
        'Run `npm run generate:e2e-fixtures` and commit the result.',
    ).toEqual(committed);
  });

  it('pins the facts the specs depend on', () => {
    const payload = readCommittedFixture();

    expect(payload.format).toBe('lcpack');
    expect(payload.schemaVersion).toBe(1);

    // Pinned clock: the fixture must not carry a wall-clock timestamp.
    expect(payload.metadata.createdAt).toBe(E2E_FIXTURE_CREATED_AT);
    expect(payload.metadata.title).toBe('Cell Structure & Function');

    // One material, carrying the canonical document and catalog tags.
    expect(payload.materials).toHaveLength(1);
    const material = payload.materials[0];
    expect(material.id).toBe('pkg_mat_cell-structure');
    expect(material.title).toBe('Cell Structure & Function');
    expect(material.tags).toEqual(['cell-biology', 'organelles', 'membrane', 'transport']);
    expect(material.documentContent).toContain('# Cell Structure & Function');

    // Full published graph, so export/import exercises real relationships.
    expect(payload.questions).toHaveLength(53);
    expect(payload.quizzes).toHaveLength(2);
    expect(payload.assets ?? []).toHaveLength(0);

    // The quiz the runner/flashcard specs select by label is the 3-item one;
    // its label stays unique next to the 50-item master quiz.
    const practice = payload.quizzes.find((quiz) => quiz.id === 'pkg_quiz_quiz-cell-001');
    expect(practice, 'Expected the canonical 3-item "Cell Structure Quiz".').toBeDefined();
    expect(practice!.title).toBe('Cell Structure Quiz');
    expect(practice!.items.map((item) => item.questionId)).toEqual([
      'pkg_q_q-cell-mc-001',
      'pkg_q_q-cell-tf-001',
      'pkg_q_q-cell-fb-001',
    ]);

    // The exact question prompts the specs assert, still reachable from the quiz.
    const byId = new Map(payload.questions.map((question) => [question.id, question]));
    expect(byId.get('pkg_q_q-cell-mc-001')?.prompt).toBe('Which organelle is responsible for producing ATP?');
    expect(byId.get('pkg_q_q-cell-tf-001')?.prompt).toBe('Prokaryotic cells have a membrane-bound nucleus.');

    // The per-blank cloze projection has no other end-to-end coverage, so the
    // fixture must actually carry a MULTI-blank question — not just the five
    // single-blank ones. Marker count has to equal `blanks.length`, because
    // `questionToCards` silently degrades a mismatch to one whole-question card.
    const cloze = byId.get('pkg_q_q-cell-fb-001') as
      | { type: string; payload: { template: string; blanks: string[] } }
      | undefined;
    expect(cloze?.type).toBe('fill_in_blank');
    expect(cloze?.payload.template.split('___').length - 1).toBe(cloze?.payload.blanks.length);
    expect(cloze?.payload.blanks).toEqual(['nucleus', 'mitochondria', 'ribosomes']);

    // Every referenced question resolves to the shipped material.
    for (const quiz of payload.quizzes) {
      for (const item of quiz.items) {
        expect(byId.get(item.questionId), `Quiz ${quiz.id} references a missing question.`).toBeDefined();
        expect(byId.get(item.questionId)?.materialId).toBe(material.id);
      }
    }
  });
});

describe('E2E share fixture: cellularRespiration', () => {
  it('produces a payload the strict client clone validator accepts', () => {
    const payload = readCommittedFixture('cellularRespiration');
    const validation = validateStudyPackage(payload);

    expect(
      validation.errors,
      'Committed fixture must pass validateStudyPackage; regenerate with `npm run generate:e2e-fixtures`.',
    ).toEqual([]);
    expect(validation.isValid).toBe(true);
  });

  it('still equals a fresh build from canonical content', () => {
    const committed = readCommittedFixture('cellularRespiration');
    const regenerated = regenerateFixture('cellularRespiration');

    expect(
      regenerated,
      'Committed fixture drifted from canonical content or the pure builder. ' +
        'Run `npm run generate:e2e-fixtures` and commit the result.',
    ).toEqual(committed);
  });

  it('pins the minimal notes material used by writer, reader, and generator coverage', () => {
    const payload = readCommittedFixture('cellularRespiration');

    expect(payload.metadata.createdAt).toBe(E2E_FIXTURE_CREATED_AT);
    expect(payload.metadata.title).toBe('Cellular Respiration');
    expect(payload.materials).toHaveLength(1);
    expect(payload.materials[0].id).toBe('pkg_mat_cellular-respiration');
    expect(payload.materials[0].title).toBe('Cellular Respiration');
    expect(payload.questions).toEqual([]);
    expect(payload.quizzes).toEqual([]);
  });
});
