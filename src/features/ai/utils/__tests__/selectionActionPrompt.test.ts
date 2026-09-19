import { describe, expect, it } from 'vitest';
import { buildSelectionActionPrompt } from '../selectionActionPrompt';

describe('buildSelectionActionPrompt', () => {
  const excerpt = 'The sinoatrial node initiates the heartbeat.';

  it('quotes the excerpt so the model sees exactly what was selected', () => {
    for (const action of ['explain', 'simplify', 'example'] as const) {
      expect(buildSelectionActionPrompt(action, excerpt)).toContain(`> "${excerpt}"`);
    }
  });

  it('asks for a clear explanation', () => {
    expect(buildSelectionActionPrompt('explain', excerpt)).toMatch(/^Please explain the following excerpt/);
  });

  it('asks for plain, memorable terms', () => {
    expect(buildSelectionActionPrompt('simplify', excerpt)).toMatch(/^Please simplify this concept/);
  });

  it('asks for a worked example', () => {
    expect(buildSelectionActionPrompt('example', excerpt)).toMatch(/^Please provide a clear, real-world example/);
  });

  it('builds a distinct prompt per action', () => {
    const prompts = new Set([
      buildSelectionActionPrompt('explain', excerpt),
      buildSelectionActionPrompt('simplify', excerpt),
      buildSelectionActionPrompt('example', excerpt),
    ]);

    expect(prompts.size).toBe(3);
  });
});
