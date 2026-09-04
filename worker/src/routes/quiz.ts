import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { IndexColumn } from 'drizzle-orm/sqlite-core';
import { json, unauthorized } from '../core/responses';
import { extractBearerToken, tokensMatch } from '../core/security';
import type { RouteContext } from '../core/types';
import { questions, quizQuestions, quizzes } from '../schema';

/**
 * GET /api/quiz
 * Public snapshot delivery of quiz content with assembled questions and items, cached for 1 hour.
 */
export async function handleGetQuiz(ctx: RouteContext): Promise<Response> {
  const { env, corsHeaders } = ctx;
  const db = drizzle(env.DB);

  const [questionRows, quizRows, junctionRows] = await Promise.all([
    db.select().from(questions).all(),
    db.select().from(quizzes).all(),
    db.select().from(quizQuestions).all(),
  ]);

  const byQuiz = new Map<string, typeof junctionRows>();
  for (const j of junctionRows) {
    const list = byQuiz.get(j.quizId) ?? [];
    list.push(j);
    byQuiz.set(j.quizId, list);
  }

  const assembledQuizzes = quizRows.map((q) => {
    const items = (byQuiz.get(q.id) ?? [])
      .toSorted((a, b) => a.order - b.order)
      .map((j) => ({
        quizId: j.quizId,
        questionId: j.questionId,
        questionVersion: j.questionVersion,
        order: j.order,
        points: j.points ?? undefined,
      }));

    return {
      ...q,
      questionIds: items.map((i) => i.questionId),
      items,
    };
  });

  return json(
    { questions: questionRows, quizzes: assembledQuizzes },
    200,
    { ...corsHeaders, 'cache-control': 'public, max-age=3600' },
  );
}

/**
 * PUT /api/quiz
 * Protected idempotent quiz bulk upsert (requires SEED_TOKEN).
 * Deconstructs assembled quizzes into questions, quizzes, and junction rows.
 */
export async function handlePutQuiz(ctx: RouteContext): Promise<Response> {
  const { request, env, corsHeaders } = ctx;

  const token = extractBearerToken(request);
  if (!(await tokensMatch(token, env.SEED_TOKEN))) {
    return unauthorized('Unauthorized', corsHeaders);
  }

  const body = (await request.json().catch(() => null)) as {
    questions?: unknown;
    quizzes?: unknown;
  } | null;

  const now = new Date().toISOString();
  const db = drizzle(env.DB);

  const upsertRow = async (
    insert: ReturnType<typeof db.insert>,
    row: Record<string, unknown>,
    target: IndexColumn | IndexColumn[],
  ) => {
    await insert
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target, set: { ...row, updatedAt: now } });
  };

  if (Array.isArray(body?.questions)) {
    await Promise.all(
      (body.questions as Array<Record<string, unknown>>).map((row) =>
        upsertRow(db.insert(questions), row, questions.id),
      ),
    );
  }

  if (Array.isArray(body?.quizzes)) {
    await Promise.all(
      (body.quizzes as Array<Record<string, unknown>>).map(async (row) => {
        const { questionIds: _questionIds, items, ...quizFields } = row;
        await upsertRow(db.insert(quizzes), quizFields, quizzes.id);

        if (Array.isArray(items)) {
          await db.delete(quizQuestions).where(eq(quizQuestions.quizId, row.id as string));
          await Promise.all(
            (items as Array<Record<string, unknown>>).map((item) =>
              db.insert(quizQuestions).values({
                quizId: row.id as string,
                questionId: item.questionId as string,
                questionVersion: item.questionVersion as number,
                order: item.order as number,
                points: (item.points as number | undefined) ?? null,
              }),
            ),
          );
        }
      }),
    );
  }

  return json({ ok: true, updatedAt: now }, 200, corsHeaders);
}
