import { describe, expect, it } from 'vitest';
import { validateServerStudyPackage } from '../routes/shares';
// The client validator cannot be imported by the Worker at runtime (separate deployable, separate
// tsconfig), so the per-type payload rules are necessarily a mirror. This test is the only place
// that can see both, which makes it the guard on the pair: a package the app can clone must be a
// package the Worker accepts, and one the Worker accepts must be one the app can clone.
import { validateStudyPackage } from '../../../src/domain/package/engines/validateStudyPackage';

/** A question-scoped payload issue: `Question "pkg_q_…": <defect>` — the shape both sides emit. */
const QUESTION_SCOPED_ISSUE = /^Question "[^"]+": /;

function question(type: string, payload: unknown): Record<string, unknown> {
  return {
    id: 'pkg_q_case',
    materialId: 'pkg_mat_1',
    type,
    prompt: 'Payload parity probe.',
    payload,
    difficulty: 'medium',
    points: 1,
  };
}

/** A minimal package whose only variable is the probe question, so a verdict isolates the payload. */
function packageWith(probe: Record<string, unknown>) {
  return {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: { title: 'Payload Parity Corpus', createdAt: '2026-09-29T00:00:00.000Z' },
    materials: [
      { id: 'pkg_mat_1', title: 'Parity Material', documentContent: 'No asset references.' },
    ],
    questions: [probe],
    quizzes: [],
  };
}

interface CorpusCase {
  name: string;
  type: string;
  payload: Record<string, unknown>;
  valid: boolean;
}

/** Valid and invalid payloads across all five types, one isolated defect per invalid case. */
const CORPUS: CorpusCase[] = [
  {
    name: 'accepts a well-formed multiple_choice',
    type: 'multiple_choice',
    payload: { type: 'multiple_choice', choices: ['Nucleus', 'Mitochondria'], correctIndex: 1 },
    valid: true,
  },
  {
    name: 'accepts a well-formed multiple_select',
    type: 'multiple_select',
    payload: { type: 'multiple_select', choices: ['A', 'B', 'C'], correctIndices: [0, 2] },
    valid: true,
  },
  {
    name: 'accepts a well-formed true_false',
    type: 'true_false',
    payload: { type: 'true_false', correctAnswer: false },
    valid: true,
  },
  {
    name: 'accepts a well-formed identification',
    type: 'identification',
    payload: {
      type: 'identification',
      correctAnswer: 'Mitochondria',
      acceptedAlternatives: ['the mitochondria'],
    },
    valid: true,
  },
  {
    name: 'accepts a well-formed fill_in_blank',
    type: 'fill_in_blank',
    payload: { type: 'fill_in_blank', template: 'A ___ and a ___.', blanks: ['cell', 'nucleus'] },
    valid: true,
  },
  {
    name: 'rejects a multiple_choice with no correctIndex',
    type: 'multiple_choice',
    payload: { type: 'multiple_choice', choices: ['A', 'B'] },
    valid: false,
  },
  {
    name: 'rejects a multiple_choice with an out-of-range correctIndex',
    type: 'multiple_choice',
    payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 2 },
    valid: false,
  },
  {
    name: 'rejects a multiple_choice with a single choice',
    type: 'multiple_choice',
    payload: { type: 'multiple_choice', choices: ['A'], correctIndex: 0 },
    valid: false,
  },
  {
    name: 'rejects a multiple_select with no correct answers',
    type: 'multiple_select',
    payload: { type: 'multiple_select', choices: ['A', 'B'], correctIndices: [] },
    valid: false,
  },
  {
    name: 'rejects a multiple_select with an out-of-range correct index',
    type: 'multiple_select',
    payload: { type: 'multiple_select', choices: ['A', 'B'], correctIndices: [0, 5] },
    valid: false,
  },
  {
    name: 'rejects a true_false whose answer is not a boolean',
    type: 'true_false',
    payload: { type: 'true_false', correctAnswer: 'true' },
    valid: false,
  },
  {
    name: 'rejects an identification with a blank correct answer',
    type: 'identification',
    payload: { type: 'identification', correctAnswer: '  ' },
    valid: false,
  },
  {
    name: 'rejects an identification with malformed alternatives',
    type: 'identification',
    payload: { type: 'identification', correctAnswer: 'Nucleus', acceptedAlternatives: 'nucleus' },
    valid: false,
  },
  {
    name: 'rejects a fill_in_blank whose marker count disagrees with its answers',
    type: 'fill_in_blank',
    payload: { type: 'fill_in_blank', template: 'The ___ is the ___.', blanks: ['nucleus'] },
    valid: false,
  },
  {
    name: 'rejects a fill_in_blank with no marker',
    type: 'fill_in_blank',
    payload: { type: 'fill_in_blank', template: 'No marker here.', blanks: ['nucleus'] },
    valid: false,
  },
  {
    name: 'rejects a fill_in_blank with a blank answer',
    type: 'fill_in_blank',
    payload: { type: 'fill_in_blank', template: 'A ___ and a ___.', blanks: ['cell', '  '] },
    valid: false,
  },
  {
    name: 'rejects a payload whose own type disagrees with the question type',
    type: 'identification',
    payload: { type: 'true_false', correctAnswer: true },
    valid: false,
  },
];

describe('question payload corpus ↔ client/Worker parity', () => {
  it.each(CORPUS)('$name', ({ type, payload, valid }) => {
    const pkg = packageWith(question(type, payload));

    const client = validateStudyPackage(pkg);
    const worker = validateServerStudyPackage(pkg);

    // Assert the expected verdict explicitly as well as the agreement, so a corpus case cannot
    // pass by both sides being wrongly permissive.
    expect(client.isValid, 'client verdict').toBe(valid);
    expect(worker.isValid, 'Worker verdict').toBe(valid);
    expect(worker.isValid).toBe(client.isValid);

    const clientIssues = client.errors.filter((error) => QUESTION_SCOPED_ISSUE.test(error));
    const workerIssues = worker.errors.filter((error) => QUESTION_SCOPED_ISSUE.test(error));

    expect(workerIssues).toEqual(clientIssues);
    if (!valid) {
      expect(clientIssues.length).toBeGreaterThan(0);
    } else {
      expect(clientIssues).toEqual([]);
    }
  });

  /**
   * The client has ONE strict tier, so a malformed payload is refused on import as well as on
   * publish. There is no path on which the two sides can disagree about a payload, which is the
   * point of the mirror: a package the Worker will not publish is a package the app will not
   * clone.
   */
  it('refuses a malformed cloze identically on the client and on the Worker', () => {
    const pkg = packageWith(
      question('fill_in_blank', {
        type: 'fill_in_blank',
        template: 'The ___ is the ___.',
        blanks: ['nucleus'],
      }),
    );

    expect(validateStudyPackage(pkg).isValid).toBe(false);
    expect(validateServerStudyPackage(pkg).isValid).toBe(false);
  });

  it('keeps provenance optional on both sides', () => {
    const pkg = packageWith(
      question('true_false', { type: 'true_false', correctAnswer: true }),
    );

    expect(validateStudyPackage(pkg).isValid).toBe(true);
    expect(validateServerStudyPackage(pkg).isValid).toBe(true);
  });
});
