import type { AnalyticsRepository } from '../../../domain/analytics/repositories/AnalyticsRepository';
import type {
    GlobalAnalytics,
    MaterialAnalytics,
} from '../../../domain/analytics/models/analytics.types';
import { computeStudyOverview } from '../../../domain/analytics/engines/overviewEngine';
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
            db.questions.filter((q) => q.status !== 'archived').toArray(),
        ]);

        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // Delegate all analytical calculations to pure domain engines
        const overview = computeStudyOverview(sessions, reviews);
        const maturity = computeCardMaturity(reviews, questions.length);
        const forecast = computeReviewForecast(reviews, 7);
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

        const activeQuestions = questions.filter((q) => q.status !== 'archived');
        const maturity = computeCardMaturity(reviews, activeQuestions.length);

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
