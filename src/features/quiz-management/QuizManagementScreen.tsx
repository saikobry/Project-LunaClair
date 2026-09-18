import { useContext } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import type { AppRoute } from '../../app/routing/routing';
import type { ManageSection } from '../../app/routing/routing';
import { useMaterial } from '../materials/hooks/queries/useMaterial';
import { useDocument } from '../reader/hooks/useDocument';
import { QuestionBankTab } from './components/QuestionBankTab';
import { QuizCatalogTab } from './components/QuizCatalogTab';
import { useQuestionManagement } from './hooks/useQuestionManagement';
import { useQuizBuilder } from './hooks/useQuizBuilder';

const styles = stylex.create({
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        color: 'var(--color-text-secondary)',
        fontSize: 14,
    },
});

interface QuizManagementScreenProps {
    materialId: string;
    onNavigate: (route: AppRoute) => void;
    /**
     * Which authoring surface to render. Owned by the workspace two-tier
     * navigation (`?tab=questions` | `?tab=quizzes`) — this screen renders
     * one section and owns no tab bar of its own.
     */
    section?: ManageSection;
}

export default function QuizManagementScreen({ materialId, onNavigate, section = 'questions' }: QuizManagementScreenProps) {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('QuizManagementScreen must be used within a <ApplicationProvider>');
    }

    const queryClient = useQueryClient();
    const { material, isLoading: materialLoading } = useMaterial(materialId);
    const { data: doc, isLoading: docLoading } = useDocument(material);

    const activeSection: ManageSection = section === 'quizzes' ? 'quizzes' : 'questions';

    const { data: questions = [], isLoading: questionsLoading } = useQuery({
        queryKey: ['assessment', 'questions', materialId],
        queryFn: ({ signal }) => context.repositories.question.getQuestions(materialId, signal),
    });

    const { data: quizzes = [], isLoading: quizzesLoading } = useQuery({
        queryKey: ['assessment', 'quizzes', materialId],
        queryFn: ({ signal }) => context.repositories.quiz.getQuizzes(materialId, signal),
    });

    const questionMgmt = useQuestionManagement();
    const quizBuilder = useQuizBuilder();

    if (materialLoading || questionsLoading || quizzesLoading || docLoading) {
        return (
            <div {...stylex.props(styles.loading)}>Loading…</div>
        );
    }

    return (
        <>
            {activeSection === 'questions' && (
                <QuestionBankTab
                    questions={questions}
                    quizzes={quizzes}
                    materialId={materialId}
                    materialTitle={material?.title ?? 'Study Material'}
                    documentMarkdown={doc?.content ?? ''}
                    onCreate={(input) => questionMgmt.createQuestion.mutate(input)}
                    onUpdate={(id, input) => questionMgmt.updateQuestion.mutate({ id, input })}
                    onPublish={(id) => questionMgmt.publishQuestion.mutate(id)}
                    onArchive={(id) => questionMgmt.archiveQuestion.mutate(id)}
                    onUnarchive={(id) => questionMgmt.unarchiveQuestion.mutate(id)}
                    onRefresh={() => {
                        queryClient.invalidateQueries({ queryKey: ['assessment', 'questions', materialId] });
                    }}
                />
            )}

            {activeSection === 'quizzes' && (
                <QuizCatalogTab
                    quizzes={quizzes}
                    materialId={materialId}
                    onNavigate={onNavigate}
                    onPublish={(id) => quizBuilder.publishQuiz.mutate(id)}
                    onArchive={(id) => quizBuilder.archiveQuiz.mutate(id)}
                    onUnarchive={(id) => quizBuilder.unarchiveQuiz.mutate(id)}
                />
            )}
        </>
    );
}
