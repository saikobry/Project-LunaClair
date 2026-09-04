import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiQuizContentRepository } from '../ApiQuizContentRepository';
import type { QuizContentSnapshot } from '../../../../domain/quiz/repositories/QuizContentRepository';

describe('ApiQuizContentRepository', () => {
  let repo: ApiQuizContentRepository;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    repo = new ApiQuizContentRepository();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed quiz content snapshot on 200 OK', async () => {
    const mockSnapshot: QuizContentSnapshot = {
      questions: [
        {
          id: 'q-1',
          materialId: 'mat-1',
          type: 'multiple_choice',
          prompt: 'What is 2+2?',
          payload: { type: 'multiple_choice', choices: ['4', '5'], correctIndex: 0 },
          difficulty: 'easy',
          points: 10,
          status: 'published',
          version: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      quizzes: [
        {
          id: 'quiz-1',
          materialId: 'mat-1',
          title: 'Math Quiz',
          items: [{ quizId: 'quiz-1', questionId: 'q-1', questionVersion: 1, order: 0 }],
          questionIds: ['q-1'],
          status: 'published',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSnapshot,
    } as unknown as Response);

    const result = await repo.getQuizContent();

    expect(result).toEqual(mockSnapshot);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/quiz', { signal: undefined });
  });

  it('throws descriptive error on non-2xx status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    } as unknown as Response);

    await expect(repo.getQuizContent()).rejects.toThrow('Failed to fetch quiz content (502)');
  });

  it('propagates network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(repo.getQuizContent()).rejects.toThrow('Failed to fetch');
  });

  it('propagates AbortSignal cancellation', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(repo.getQuizContent(controller.signal)).rejects.toThrow('Aborted');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/quiz', { signal: controller.signal });
  });
});
