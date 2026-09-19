import { describe, expect, it } from 'vitest';
import { buildAiDeletionDialogCopy } from '../deletionDialogCopy';

describe('buildAiDeletionDialogCopy', () => {
  it('names the whole scope when deleting every conversation', () => {
    const copy = buildAiDeletionDialogCopy({ kind: 'all' });

    expect(copy.title).toBe('Delete every conversation?');
    expect(copy.message).toMatch(/All conversations for this material/);
    expect(copy.confirmLabel).toBe('Delete all');
  });

  it('names the conversation being deleted', () => {
    const copy = buildAiDeletionDialogCopy({
      kind: 'session',
      threadId: 'thread-1',
      title: 'What is the sinoatrial node?',
    });

    expect(copy.title).toBe('Delete this conversation?');
    expect(copy.message).toContain('What is the sinoatrial node?');
    expect(copy.confirmLabel).toBe('Delete');
  });

  it('states that the deletion is unrecoverable, per the removal vocabulary', () => {
    // AI history is device-local and deleted outright, unlike library materials whose share survives.
    expect(buildAiDeletionDialogCopy({ kind: 'all' }).message).toMatch(/cannot be recovered/);
    expect(
      buildAiDeletionDialogCopy({ kind: 'session', threadId: 't', title: 'X' }).message,
    ).toMatch(/cannot be recovered/);
  });
});
