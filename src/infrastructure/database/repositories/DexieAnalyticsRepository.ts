import type { AnalyticsRepository } from '../../../domain/analytics/repositories/AnalyticsRepository';
import type {
    GlobalAnalytics,
    MaterialAnalytics,
} from '../../../domain/analytics/models/analytics.types';
import { computeStudyOverview } from '../../../domain/analytics/engines/overviewEngine';
import { buildCardKeyPool } from '../../../domain/analytics/engines/cardKeyPool';
import { computeCardMaturity, computeReviewForecast } from '../../../domain/analytics/engines/retentionEngine';
import { computeTopicMastery } from '../../../domain/analytics/engines/masteryEngine';
import { buildActivityCalendar } from '../../../domain/analytics/engines/activityEngine';
import { db } from '../schema/LunaClairDatabase';

export class DexieAnalyticsRepository implements AnalyticsRepository {
    async getGlobalAnalytics(signal?: AbortSignal): Promise<GlobalAnalytics> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // Fetch all raw datasets concurrently
        const [sessions, reviews, questions] = await Promise.all([
            // Index lookup rather than a full-store scan with a JS predicate (v15 added `status`).
            db.quizSessions.where('status').equals('completed').toArray(),
            db.flashcardReviews.toArray(),
            db.questions.toArray(),
        ]);

        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // The card pool is the union of the projected card keys over every
        // in-scope question — NOT a question count. `buildCardKeyPool` owns the
        // archived exclusion and runs the same `questionToCards` projection the
        // study deck runs, so the maturity buckets measure the deck the learner
        // actually has. ONE pool is passed to every engine that scopes to current
        // cards, so the overview's "cards with history" figure and the maturity bar
        // beside it cannot be measured against different denominators.
        const cardKeys = buildCardKeyPool(questions);

        // Delegate all analytical calculations to pure domain engines. The
        // overview is pool-scoped for its current-workload figure only; its
        // review totals, last activity, and streak stay on full review history.
        const overview = computeStudyOverview(sessions, reviews, cardKeys);
        const maturity = computeCardMaturity(reviews, cardKeys);
        const forecast = computeReviewForecast(reviews, cardKeys, 7);
        // Historical: a review of a since-deleted card still happened, so the
        // calendar keeps counting it (only the forecast is pool-scoped).
        const activity = buildActivityCalendar(sessions, reviews, 365);

        return {
            overview,
            maturity,
            forecast,
            activity,
        };
    }

    async getMaterialAnalytics(materialId: string, signal?: AbortSignal): Promise<MaterialAnalytics | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const material = await db.materials.get(materialId);
        if (!material) return null;

        const [questions, reviews, sessions] = await Promise.all([
            db.questions.where('materialId').equals(materialId).toArray(),
            db.flashcardReviews.where('materialId').equals(materialId).toArray(),
            db.quizSessions.where('status').equals('completed').toArray(),
        ]);

        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // Filter sessions that have question snapshots belonging to this material
        const materialSessions = sessions.filter((s) =>
            Object.values(s.questionSnapshots || {}).some((q) => q.materialId === materialId),
        );

        let totalAnswered = 0;
        let correctAnswers = 0;

        for (const session of materialSessions) {
            if (!session.answers) continue;
            for (const answer of session.answers) {
                const snapshot = session.questionSnapshots?.[answer.questionId];
                if (snapshot && snapshot.materialId === materialId) {
                    totalAnswered += 1;
                    if (answer.isCorrect) {
                        correctAnswers += 1;
                    }
                }
            }
        }

        const accuracy = totalAnswered > 0
            ? Number(((correctAnswers / totalAnswered) * 100).toFixed(2))
            : 0;

        let totalCardReviews = 0;
        for (const r of reviews) {
            totalCardReviews += r.reviewCount || 0;
        }

        // Same projection as the global scope, restricted to this material's
        // questions — a per-material question count would understate a cloze
        // question's per-blank cards exactly as the global one did.
        const cardKeys = buildCardKeyPool(questions);
        const maturity = computeCardMaturity(reviews, cardKeys);

        // Filter material sessions to only questions from this material for topic mastery
        const sanitizedSessions = materialSessions.map((session) => ({
            ...session,
            questionSnapshots: Object.fromEntries(
                Object.entries(session.questionSnapshots || {}).filter(([, q]) => q.materialId === materialId),
            ),
            answers: session.answers.filter((a) => {
                const q = session.questionSnapshots?.[a.questionId];
                return q && q.materialId === materialId;
            }),
        }));

        const topics = computeTopicMastery(sanitizedSessions);

        return {
            materialId,
            overview: {
                quizzesCompleted: materialSessions.length,
                totalAnswered,
                correctAnswers,
                accuracy,
                totalCardReviews,
            },
            maturity,
            topics,
        };
    }
}

export const dexieAnalyticsRepository = new DexieAnalyticsRepository();
