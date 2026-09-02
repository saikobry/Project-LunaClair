import * as stylex from '@stylexjs/stylex';
import { Award, AlertCircle } from 'lucide-react';
import type { SubjectMastery } from '../../../../domain/analytics/models/analytics.types';
import { Card } from '../../../../shared/ui/Card/Card';

const styles = stylex.create({
    cardContent: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
    },
    titleGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    subjectTitle: {
        fontSize: 18,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    subjectMeta: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
    scoreBadge: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    scoreValue: {
        fontSize: 22,
        fontWeight: 700,
        color: 'var(--color-text-primary)',
    },
    scoreLabel: {
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        margin: 0,
    },
    badgeRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
    },
    strengthBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        color: '#059669',
    },
    weaknessBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        color: '#D97706',
    },
    topicList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    topicRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    topicHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
    },
    topicTag: {
        fontWeight: 500,
        color: 'var(--color-text-primary)',
    },
    topicScore: {
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
    },
    progressBar: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        backgroundColor: 'var(--color-background-muted)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
        transition: 'width 0.3s ease',
    },
    fillMastered: {
        backgroundColor: '#10B981',
    },
    fillProficient: {
        backgroundColor: '#3B82F6',
    },
    fillNeedsPractice: {
        backgroundColor: '#F59E0B',
    },
    fillUnattempted: {
        backgroundColor: '#94A3B8',
    },
    emptyNotice: {
        fontSize: 13,
        color: 'var(--color-text-disabled)',
        fontStyle: 'italic',
    },
});

interface SubjectMasteryCardProps {
    subject: SubjectMastery;
}

export function SubjectMasteryCard({ subject }: SubjectMasteryCardProps) {
    return (
        <Card>
            <div {...stylex.props(styles.cardContent)}>
                {/* Header */}
                <div {...stylex.props(styles.header)}>
                    <div {...stylex.props(styles.titleGroup)}>
                        <h3 {...stylex.props(styles.subjectTitle)}>{subject.subjectName}</h3>
                        <p {...stylex.props(styles.subjectMeta)}>
                            {subject.totalQuizzes} {subject.totalQuizzes === 1 ? 'quiz' : 'quizzes'} · {subject.attemptCount} question attempts
                        </p>
                    </div>
                    <div {...stylex.props(styles.scoreBadge)}>
                        <span {...stylex.props(styles.scoreValue)}>
                            {subject.attemptCount > 0 ? `${Math.round(subject.weightedScore)}%` : '—'}
                        </span>
                        <span {...stylex.props(styles.scoreLabel)}>Mastery</span>
                    </div>
                </div>

                {/* Strengths & Focus Areas */}
                {(subject.strengths.length > 0 || subject.weaknesses.length > 0) && (
                    <div {...stylex.props(styles.section)}>
                        {subject.strengths.length > 0 && (
                            <div>
                                <span {...stylex.props(styles.sectionTitle)}>Top Strengths</span>
                                <div {...stylex.props(styles.badgeRow)} style={{ marginTop: 4 }}>
                                    {subject.strengths.map((s) => (
                                        <span key={s.tag} {...stylex.props(styles.strengthBadge)}>
                                            <Award size={12} />
                                            {s.tag} ({Math.round(s.weightedScore)}%)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {subject.weaknesses.length > 0 && (
                            <div style={{ marginTop: subject.strengths.length > 0 ? 8 : 0 }}>
                                <span {...stylex.props(styles.sectionTitle)}>Areas to Reinforce</span>
                                <div {...stylex.props(styles.badgeRow)} style={{ marginTop: 4 }}>
                                    {subject.weaknesses.map((w) => (
                                        <span key={w.tag} {...stylex.props(styles.weaknessBadge)}>
                                            <AlertCircle size={12} />
                                            {w.tag} ({Math.round(w.weightedScore)}%)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Topics Breakdown */}
                <div {...stylex.props(styles.section)}>
                    <span {...stylex.props(styles.sectionTitle)}>Topic Breakdown</span>
                    {subject.topics.length === 0 ? (
                        <span {...stylex.props(styles.emptyNotice)}>No topic attempts recorded yet</span>
                    ) : (
                        <div {...stylex.props(styles.topicList)}>
                            {subject.topics.map((topic) => {
                                const fillStyle = topic.status === 'mastered'
                                    ? styles.fillMastered
                                    : topic.status === 'proficient'
                                        ? styles.fillProficient
                                        : topic.status === 'needs_practice'
                                            ? styles.fillNeedsPractice
                                            : styles.fillUnattempted;

                                return (
                                    <div key={topic.tag} {...stylex.props(styles.topicRow)}>
                                        <div {...stylex.props(styles.topicHeader)}>
                                            <span {...stylex.props(styles.topicTag)}>{topic.tag}</span>
                                            <span {...stylex.props(styles.topicScore)}>
                                                {topic.attemptCount > 0 ? `${Math.round(topic.weightedScore)}%` : 'Unattempted'}
                                            </span>
                                        </div>
                                        <div {...stylex.props(styles.progressBar)}>
                                            <div
                                                {...stylex.props(styles.progressFill, fillStyle)}
                                                style={{ width: topic.attemptCount > 0 ? `${Math.max(4, Math.round(topic.weightedScore))}%` : '0%' }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
