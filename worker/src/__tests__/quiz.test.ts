import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from '../index';
import { createMockD1 } from './helpers/mockD1';

describe('Worker /api/quiz Endpoints', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      DB: createMockD1(),
      SEED_TOKEN: 'correct-seed-token',
      CORS_ORIGINS: 'https://test.lunaclair.app',
    };
  });

  const sampleQuizData = {
    questions: [
      {
        id: 'q-1',
        materialId: 'mat-1',
        type: 'multiple-choice',
        prompt: 'What is the powerhouse of the cell?',
        payload: JSON.stringify({ options: ['Nucleus', 'Mitochondria', 'Ribosome'] }),
        difficulty: 'easy',
        points: 10,
        status: 'published',
        version: 1,
      },
    ],
    quizzes: [
      {
        id: 'quiz-1',
        materialId: 'mat-1',
        title: 'Cell Biology Quiz',
        description: 'Test your cell knowledge',
        status: 'published',
        items: [
          {
            quizId: 'quiz-1',
            questionId: 'q-1',
            questionVersion: 1,
            order: 1,
            points: 10,
          },
        ],
      },
    ],
  };

  it('rejects PUT /api/quiz without valid SEED_TOKEN', async () => {
    const req = new Request('https://api.test/api/quiz', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer wrong-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleQuizData),
    });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(401);
  });

  it('upserts questions, quizzes, and junction rows via PUT and serves assembled quiz via GET', async () => {
    // 1. First seed material (foreign key requirement)
    await worker.fetch(
      new Request('https://api.test/api/catalog', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer correct-seed-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materials: [
            {
              id: 'mat-1',
              title: 'Material 1',
              documentId: 'doc-1',
            },
          ],
        }),
      }),
      env,
    );

    // 2. PUT quiz
    const putReq = new Request('https://api.test/api/quiz', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer correct-seed-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleQuizData),
    });
    const putRes = await worker.fetch(putReq, env);

    expect(putRes.status).toBe(200);
    expect(await putRes.json()).toEqual(
      expect.objectContaining({ ok: true, updatedAt: expect.any(String) }),
    );

    // 3. GET quiz
    const getReq = new Request('https://api.test/api/quiz');
    const getRes = await worker.fetch(getReq, env);

    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('cache-control')).toBe('public, max-age=3600');
    const data = (await getRes.json()) as {
      questions: Array<{ id: string; prompt: string }>;
      quizzes: Array<{
        id: string;
        title: string;
        questionIds: string[];
        items: Array<{ questionId: string; order: number }>;
      }>;
    };

    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].id).toBe('q-1');
    expect(data.quizzes).toHaveLength(1);
    expect(data.quizzes[0].id).toBe('quiz-1');
    expect(data.quizzes[0].questionIds).toEqual(['q-1']);
    expect(data.quizzes[0].items).toHaveLength(1);
    expect(data.quizzes[0].items[0].questionId).toBe('q-1');
  });
});
