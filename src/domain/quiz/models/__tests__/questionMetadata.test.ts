import { describe, it, expect } from 'vitest';
import type { QuestionType } from '../QuestionType';
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  VALID_QUESTION_TYPES,
} from '../questionMetadata';

describe('questionMetadata', () => {
  it('lists all five question types in canonical order', () => {
    expect(QUESTION_TYPES).toEqual([
      'multiple_choice',
      'multiple_select',
      'true_false',
      'identification',
      'fill_in_blank',
    ]);
  });

  it('labels every listed type exactly once with the canonical spellings', () => {
    expect(Object.keys(QUESTION_TYPE_LABELS)).toHaveLength(QUESTION_TYPES.length);
    expect(QUESTION_TYPE_LABELS).toEqual({
      multiple_choice: 'Multiple Choice',
      multiple_select: 'Multiple Select',
      true_false: 'True / False',
      identification: 'Identification',
      fill_in_blank: 'Fill in the Blank',
    });
  });

  it('derives the validity set from the ordered list', () => {
    expect(VALID_QUESTION_TYPES.size).toBe(QUESTION_TYPES.length);
    for (const type of QUESTION_TYPES) {
      expect(VALID_QUESTION_TYPES.has(type)).toBe(true);
    }
    expect(VALID_QUESTION_TYPES.has('bogus_type' as QuestionType)).toBe(false);
  });
});
