import { describe, expect, it } from 'vitest';
import { validateQuestionPayload } from '../questionPayloadValidation';

/**
 * Pure, literal-asserting unit tests for the shared payload validator. Expected messages are
 * written out in full rather than rebuilt from the module, so a message reword is a visible test
 * change — the client and the Worker both mirror this exact wording.
 */
describe('validateQuestionPayload', () => {
  it('accepts a well-formed payload of every type', () => {
    expect(
      validateQuestionPayload('multiple_choice', {
        type: 'multiple_choice',
        choices: ['Nucleus', 'Mitochondria'],
        correctIndex: 1,
      }),
    ).toEqual([]);

    expect(
      validateQuestionPayload('multiple_select', {
        type: 'multiple_select',
        choices: ['Nucleus', 'Mitochondria', 'Ribosome'],
        correctIndices: [0, 2],
      }),
    ).toEqual([]);

    expect(
      validateQuestionPayload('true_false', {
        type: 'true_false',
        correctAnswer: false,
      }),
    ).toEqual([]);

    expect(
      validateQuestionPayload('identification', {
        type: 'identification',
        correctAnswer: 'Mitochondria',
        acceptedAlternatives: ['the mitochondria'],
      }),
    ).toEqual([]);

    expect(
      validateQuestionPayload('identification', {
        type: 'identification',
        correctAnswer: 'Mitochondria',
      }),
    ).toEqual([]);

    expect(
      validateQuestionPayload('fill_in_blank', {
        type: 'fill_in_blank',
        template: 'The ___ is the ___ of the cell.',
        blanks: ['nucleus', 'control center'],
      }),
    ).toEqual([]);
  });

  it('reports a payload that is not a non-null object', () => {
    const expected = ['payload must be a non-null object.'];

    expect(validateQuestionPayload('true_false', null)).toEqual(expected);
    expect(validateQuestionPayload('true_false', undefined)).toEqual(expected);
    expect(validateQuestionPayload('true_false', 'nope')).toEqual(expected);
    expect(validateQuestionPayload('true_false', [])).toEqual(expected);
  });

  it('reports a payload whose own type disagrees with the declared question type', () => {
    // The two discriminants describe one fact; dispatch reads `payload.type` (`questionToCards`)
    // while authors read `q.type`, so a disagreement is malformed even if the body parses.
    expect(
      validateQuestionPayload('multiple_choice', {
        type: 'true_false',
        choices: ['A', 'B'],
        correctIndex: 0,
      }),
    ).toEqual([
      'payload.type "true_false" does not match question type "multiple_choice".',
    ]);

    expect(validateQuestionPayload('true_false', { correctAnswer: true })).toEqual([
      'payload.type "undefined" does not match question type "true_false".',
    ]);
  });

  it('rejects a multiple_choice with no determinable correct answer', () => {
    // Never defaulted to the first choice: that asserts a fact the author never supplied.
    expect(
      validateQuestionPayload('multiple_choice', {
        type: 'multiple_choice',
        choices: ['A', 'B'],
        correctIndex: 2,
      }),
    ).toEqual([
      'multiple_choice payload requires "correctIndex" to be an integer within the choices range.',
    ]);

    expect(
      validateQuestionPayload('multiple_choice', {
        type: 'multiple_choice',
        choices: ['A', 'B'],
      }),
    ).toEqual([
      'multiple_choice payload requires "correctIndex" to be an integer within the choices range.',
    ]);

    expect(
      validateQuestionPayload('multiple_choice', {
        type: 'multiple_choice',
        choices: ['A', 'B'],
        correctIndex: 0.5,
      }),
    ).toEqual([
      'multiple_choice payload requires "correctIndex" to be an integer within the choices range.',
    ]);
  });

  it('rejects multiple_choice choices that are too few or blank', () => {
    expect(
      validateQuestionPayload('multiple_choice', {
        type: 'multiple_choice',
        choices: ['Only one'],
        correctIndex: 0,
      }),
    ).toEqual([
      'multiple_choice payload requires a "choices" array of at least 2 non-empty strings.',
    ]);

    expect(
      validateQuestionPayload('multiple_choice', {
        type: 'multiple_choice',
        choices: ['A', '   '],
        correctIndex: 0,
      }),
    ).toEqual([
      'multiple_choice payload requires a "choices" array of at least 2 non-empty strings.',
    ]);
  });

  it('rejects a multiple_select with no determinable correct answers', () => {
    expect(
      validateQuestionPayload('multiple_select', {
        type: 'multiple_select',
        choices: ['A', 'B', 'C'],
        correctIndices: [],
      }),
    ).toEqual([
      'multiple_select payload requires a non-empty "correctIndices" array of integers within the choices range.',
    ]);

    expect(
      validateQuestionPayload('multiple_select', {
        type: 'multiple_select',
        choices: ['A', 'B', 'C'],
        correctIndices: [0, 3],
      }),
    ).toEqual([
      'multiple_select payload requires a non-empty "correctIndices" array of integers within the choices range.',
    ]);
  });

  it('rejects a true_false whose answer is not a boolean', () => {
    expect(
      validateQuestionPayload('true_false', { type: 'true_false', correctAnswer: 'true' }),
    ).toEqual(['true_false payload requires a boolean "correctAnswer".']);
  });

  it('rejects an identification with no correct answer, and malformed alternatives', () => {
    expect(
      validateQuestionPayload('identification', { type: 'identification', correctAnswer: '  ' }),
    ).toEqual(['identification payload requires a non-empty "correctAnswer" string.']);

    expect(
      validateQuestionPayload('identification', {
        type: 'identification',
        correctAnswer: 'Nucleus',
        acceptedAlternatives: 'nucleus',
      }),
    ).toEqual([
      'identification payload "acceptedAlternatives" must be an array of strings when provided.',
    ]);
  });

  it('rejects a fill_in_blank whose marker count disagrees with its answers', () => {
    // The load-bearing case: `questionToCards` silently degrades exactly this shape to one
    // whole-question card, so it must be reported here rather than absorbed downstream.
    expect(
      validateQuestionPayload('fill_in_blank', {
        type: 'fill_in_blank',
        template: 'The ___ is the ___ of the cell.',
        blanks: ['nucleus'],
      }),
    ).toEqual([
      'fill_in_blank payload requires exactly one answer per "___" placeholder (2 in template, 1 supplied).',
    ]);

    expect(
      validateQuestionPayload('fill_in_blank', {
        type: 'fill_in_blank',
        template: 'The ___ is the ___ of the cell.',
        blanks: ['nucleus', 'a', 'b'],
      }),
    ).toEqual([
      'fill_in_blank payload requires exactly one answer per "___" placeholder (2 in template, 3 supplied).',
    ]);
  });

  it('rejects a fill_in_blank with no marker at all', () => {
    expect(
      validateQuestionPayload('fill_in_blank', {
        type: 'fill_in_blank',
        template: 'The nucleus is the control center.',
        blanks: ['nucleus'],
      }),
    ).toEqual([
      'fill_in_blank payload requires a "template" string with at least one "___" placeholder.',
    ]);
  });

  it('rejects a fill_in_blank with a blank, empty answer', () => {
    expect(
      validateQuestionPayload('fill_in_blank', {
        type: 'fill_in_blank',
        template: 'The ___ is the ___ of the cell.',
        blanks: ['nucleus', '   '],
      }),
    ).toEqual([
      'fill_in_blank payload requires a non-empty answer for every "___" placeholder.',
    ]);
  });
});
