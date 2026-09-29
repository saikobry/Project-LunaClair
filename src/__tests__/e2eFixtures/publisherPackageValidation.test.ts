import { describe, expect, it } from 'vitest';
import { buildPackageForMaterial, selfValidatePackage } from '../../../scripts/lib/studyPackageBuilder.mjs';
import { validateStudyPackage } from '../../domain/package/engines/validateStudyPackage';

/**
 * The publisher seeder's dry run is the gate that runs BEFORE anything is published, so it has to
 * refuse exactly what `POST /api/shares` refuses. It used to be payload-shape-generic: it checked
 * that a question carried *an* object and nothing more, so a cloze whose `___` count disagreed with
 * its `blanks.length` sailed through a `PASS` and was only rejected at the endpoint, after a round
 * trip.
 *
 * The fix is that the dry run applies the client's own strict rules rather than restating them, so
 * these tests assert the property that matters: **the builder's verdict and the client publish
 * tier's verdict agree.** That is a stronger statement than "the builder rejects this shape", and it
 * fails if someone reintroduces a looser check here.
 *
 * Lives under `src/__tests__/e2eFixtures/` because it reaches outside `src/` to import
 * `scripts/lib/studyPackageBuilder.mjs`; that folder is excluded from every tsconfig project for
 * exactly that reason (it already holds the builder's freshness/validity contract).
 */

const CREATED_AT = '2026-09-01T12:00:00.000Z';

const MATERIAL = { id: 'cell-structure', title: 'Cell Structure' };

/** Builds a one-question package exactly the way the seeder CLI builds it. */
function build(questions: unknown[]) {
  return buildPackageForMaterial({
    material: MATERIAL,
    markdown: '# Cell Structure',
    assets: [],
    questions,
    quizzes: [],
    createdAt: CREATED_AT,
  });
}

function question(overrides: Record<string, unknown>) {
  return {
    id: 'q-1',
    materialId: MATERIAL.id,
    status: 'published',
    prompt: 'Fill in the blank:',
    difficulty: 'medium',
    points: 1,
    ...overrides,
  };
}

describe('publisher seeder dry run: the strict client rules', () => {
  it('rejects a cloze whose ___ count disagrees with its answers, as the Worker would', () => {
    // Two markers, one answer: the defect the dry run used to pass through silently.
    const result = build([
      question({
        id: 'q-fb-1',
        type: 'fill_in_blank',
        payload: {
          type: 'fill_in_blank',
          template: 'The ___ is the ___ of the cell.',
          blanks: ['nucleus'],
        },
      }),
    ]);

    expect(result.errors).toContain(
      'Question "pkg_q_q-fb-1": fill_in_blank payload requires exactly one answer per "___" placeholder (2 in template, 1 supplied).',
    );

    // And it is the same verdict the endpoint would reach, not a local invention.
    expect(validateStudyPackage(result.payload).isValid).toBe(false);
    expect(validateStudyPackage(result.payload).errors).toContain(
      'Question "pkg_q_q-fb-1": fill_in_blank payload requires exactly one answer per "___" placeholder (2 in template, 1 supplied).',
    );
  });

  it('rejects a cloze whose answer is blank, which the dry run also used to pass through', () => {
    const result = build([
      question({
        id: 'q-fb-2',
        type: 'fill_in_blank',
        payload: { type: 'fill_in_blank', template: 'The ___ is central.', blanks: [''] },
      }),
    ]);

    expect(result.errors).toContain(
      'Question "pkg_q_q-fb-2": fill_in_blank payload requires a non-empty answer for every "___" placeholder.',
    );
    expect(validateStudyPackage(result.payload).isValid).toBe(false);
  });

  it('rejects a payload whose own type disagrees with the question type', () => {
    const result = build([
      question({
        id: 'q-mismatch',
        type: 'identification',
        payload: { type: 'true_false', correctAnswer: true },
      }),
    ]);

    expect(result.errors).toContain(
      'Question "pkg_q_q-mismatch": payload.type "true_false" does not match question type "identification".',
    );
    expect(validateStudyPackage(result.payload).isValid).toBe(false);
  });

  it('still accepts a well-formed package, so the gate is not over-broad', () => {
    const result = build([
      question({
        id: 'q-fb-ok',
        type: 'fill_in_blank',
        payload: {
          type: 'fill_in_blank',
          template: 'The ___ is the ___ of the cell.',
          blanks: ['nucleus', 'nucleolus'],
        },
      }),
      question({
        id: 'q-mc-ok',
        type: 'multiple_choice',
        payload: {
          type: 'multiple_choice',
          choices: ['Nucleus', 'Mitochondria'],
          correctIndex: 1,
        },
      }),
      question({
        id: 'q-tf-ok',
        type: 'true_false',
        payload: { type: 'true_false', correctAnswer: true },
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(validateStudyPackage(result.payload).isValid).toBe(true);
  });

  it('leaves the size guard, the pkg_* ID rules, and the warning behaviour untouched', () => {
    // Unchanged by the payload rules: a sound package still carries scoped ids, still reports its
    // untagged material as a WARNING rather than an error, and still passes.
    const result = buildPackageForMaterial({
      material: { id: 'cell-structure', title: 'Cell Structure' },
      markdown: '# Cell Structure',
      assets: [],
      questions: [question({ id: 'q-ok', type: 'true_false', payload: { type: 'true_false', correctAnswer: false } })],
      quizzes: [],
      createdAt: CREATED_AT,
    });

    expect(result.errors).toEqual([]);
    expect(result.payload.questions[0].id).toMatch(/^pkg_q_[a-zA-Z0-9_-]+$/);
    expect(result.payload.materials[0].id).toMatch(/^pkg_mat_[a-zA-Z0-9_-]+$/);
    expect(result.warnings).toContain(
      'Material "cell-structure" has no tags: add a "tags" array to its content/catalog/materials.json entry.',
    );
  });

  it('does not double-report a question whose payload is missing or whose type is unknown', () => {
    // The two guards the payload call inherits from `validateStudyPackage`: it only runs for a
    // known type with an object payload, so the builder's own errors stay the single report.
    const missingPayload = selfValidatePackage({
      format: 'lcpack',
      schemaVersion: 1,
      metadata: { title: 'T', createdAt: CREATED_AT },
      materials: [{ id: 'pkg_mat_1', title: 'M', documentContent: 'x', tags: ['a'] }],
      questions: [
        { id: 'pkg_q_1', materialId: 'pkg_mat_1', type: 'fill_in_blank', prompt: 'p', difficulty: 'medium', points: 1 },
      ],
      quizzes: [],
    });

    expect(missingPayload).toEqual(['Question "pkg_q_1" must have a payload object.']);

    const unknownType = selfValidatePackage({
      format: 'lcpack',
      schemaVersion: 1,
      metadata: { title: 'T', createdAt: CREATED_AT },
      materials: [{ id: 'pkg_mat_1', title: 'M', documentContent: 'x', tags: ['a'] }],
      questions: [
        { id: 'pkg_q_1', materialId: 'pkg_mat_1', type: '_false', prompt: 'p', payload: {}, difficulty: 'medium', points: 1 },
      ],
      quizzes: [],
    });

    expect(unknownType).toEqual(['Question "pkg_q_1" has invalid type "_false".']);
  });
});
