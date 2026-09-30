import { useContext } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import type { AppRoute } from '../../app/routing/routing';
import type { ManageSection, MaterialWorkspaceTab } from '../../app/routing/routing';
import { useMaterial } from '../materials/hooks/queries/useMaterial';
import { useDocument } from '../reader/hooks/useDocument';
import { QuestionBankTab } from './components/QuestionBankTab';
import { QuizCatalogTab } from './components/QuizCatalogTab';
import { useQuestionManagement } from './hooks/useQuestionManagement';
import { useQuizBuilder } from './hooks/useQuizBuilder';
import type { GeneratorLaunchChannel } from './hooks/useGeneratorLaunchClaim';

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

interface QuizManagementTabProps {
    materialId: string;
    onNavigate: (route: AppRoute) => void;
    /**
     * Which authoring surface to render. Owned by the workspace two-tier
     * navigation (`?tab=questions` | `?tab=quizzes`) — this screen renders
     * one section and owns no tab bar of its own.
     */
    section?: ManageSection;
    /**
     * Returns the workspace to a sibling tab. The Question Bank offers it on the
     * generator's done step when it was reached through a launch intent, so a
     * study surface that sent the user here can bring them straight back.
     */
    onReturnToTab?: (tab: MaterialWorkspaceTab) => void;
    /**
     * The workspace screen's one-shot launch intent — the pending request plus the single
     * command that retires it. Passed through untouched: the workspace owns the state and
     * this screen only carries it to the section that acts on it. Required rather than
     * optional so no caller can silently drop the handoff.
     */
    generatorLaunch: GeneratorLaunchChannel;
}

export default function QuizManagementTab({ materialId, onNavigate, section = 'questions', onReturnToTab, generatorLaunch }: QuizManagementTabProps) {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('QuizManagementTab must be used within a <ApplicationProvider>');
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
                    onCreate={(input) => questionMgmt.createQuestion.mutateAsync(input)}
                    onUpdate={(id, input) => questionMgmt.updateQuestion.mutateAsync({ id, input })}
                    onPublish={(id) => questionMgmt.publishQuestion.mutate(id)}
                    onArchive={(id) => questionMgmt.archiveQuestion.mutate(id)}
                    onUnarchive={(id) => questionMgmt.unarchiveQuestion.mutate(id)}
                    onRefresh={() => {
                        queryClient.invalidateQueries({ queryKey: ['assessment', 'questions', materialId] });
                    }}
                    onReturnToTab={onReturnToTab}
                    generatorLaunch={generatorLaunch}
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
