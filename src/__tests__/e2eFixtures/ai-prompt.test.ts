import { describe, it, expect } from 'vitest';

import {
  describeUnreadableAllowedTypes,
  readAllowedQuestionTypes,
  requestsOnlyType,
  type AiChatRequestBody,
} from '../../../tests/e2e/helpers/ai-prompt';

/**
 * These pin the four cases a route mock has to survive: the line present, the line
 * absent, an unexpected format, and several types listed. They exist so a prompt
 * reword is a one-line helper fix rather than a confusing failure inside a browser spec.
 */

/** The app's real criteria block, with only the parts the reader needs. */
function systemPrompt(allowedTypesLine: string): string {
  return [
    'You are an expert educational assessment author for Project LunaClair.',
    '',
    'TARGET CRITERIA:',
    '- Count: exactly 5 questions',
    '- Target Difficulty: mixed (mix of easy, medium, hard)',
    allowedTypesLine,
    '',
    'CRITICAL RULES:',
    '1. Every question MUST be answerable from the provided study material.',
  ].join('\n');
}

function request(content: string): AiChatRequestBody {
  return {
    messages: [
      { role: 'system', content },
      { role: 'user', content: 'Study Material Content:\n---\n# Notes\n---\n\nGenerate 5 questions.' },
    ],
  };
}

describe('readAllowedQuestionTypes', () => {
  it('reads the single requested type off the system prompt line', () => {
    const body = request(systemPrompt('- Allowed Question Types: fill_in_blank'));

    expect(readAllowedQuestionTypes(body.messages ?? [])).toEqual(['fill_in_blank']);
    expect(requestsOnlyType(body.messages ?? [], 'fill_in_blank')).toBe(true);
  });

  it('lists every type when several are requested', () => {
    const body = request(
      systemPrompt('- Allowed Question Types: multiple_choice, true_false, fill_in_blank'),
    );

    expect(readAllowedQuestionTypes(body.messages ?? [])).toEqual([
      'multiple_choice',
      'true_false',
      'fill_in_blank',
    ]);
    // The card path is a *narrowed* request, so a mixed batch must not read as one.
    expect(requestsOnlyType(body.messages ?? [], 'fill_in_blank')).toBe(false);
  });

  it('reads the last system message when several are present', () => {
    const body: AiChatRequestBody = {
      messages: [
        { role: 'system', content: systemPrompt('- Allowed Question Types: identification') },
        { role: 'user', content: 'Generate 5 questions.' },
        { role: 'system', content: systemPrompt('- Allowed Question Types: true_false') },
      ],
    };

    expect(readAllowedQuestionTypes(body.messages ?? [])).toEqual(['true_false']);
  });

  it('returns nothing when the line is absent, rather than throwing', () => {
    const body = request('You are an expert educational assessment author.');

    expect(readAllowedQuestionTypes(body.messages ?? [])).toEqual([]);
    expect(requestsOnlyType(body.messages ?? [], 'fill_in_blank')).toBe(false);
  });

  it('returns nothing when there is no system message at all', () => {
    const body: AiChatRequestBody = { messages: [{ role: 'user', content: 'Generate 5 questions.' }] };

    expect(readAllowedQuestionTypes(body.messages ?? [])).toEqual([]);
  });

  it('tolerates a reworded line: different bullet, casing, and spacing', () => {
    const cases = [
      '* ALLOWED QUESTION TYPES:  fill_in_blank  ',
      '• Allowed Question Types:fill_in_blank',
      '-   Allowed   Question   Types:   fill_in_blank   ',
    ];

    for (const line of cases) {
      expect(readAllowedQuestionTypes(request(systemPrompt(line)).messages ?? [])).toEqual([
        'fill_in_blank',
      ]);
    }
  });

  it('tolerates an unexpected value format by yielding nothing, not a wrong answer', () => {
    // The line exists but names no type. Reporting "no types" routes a mock to its
    // default branch; guessing one here would answer the wrong request silently.
    const body = request(systemPrompt('- Allowed Question Types:'));

    expect(readAllowedQuestionTypes(body.messages ?? [])).toEqual([]);
  });

  it('ignores a malformed request body instead of throwing', () => {
    expect(readAllowedQuestionTypes([])).toEqual([]);
    // A route mock must not crash on a body it does not recognise.
    expect(readAllowedQuestionTypes(undefined as never)).toEqual([]);
  });
});

describe('describeUnreadableAllowedTypes', () => {
  it('distinguishes a renamed line from an unparseable value', () => {
    expect(describeUnreadableAllowedTypes('Some other prompt')).toContain('no "Allowed Question Types" line');
    expect(describeUnreadableAllowedTypes('- Allowed Question Types:')).toContain(
      'could not be parsed',
    );
  });
});
