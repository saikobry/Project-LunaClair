import { useState, useContext } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Library, ListChecks } from 'lucide-react';
import type { StudyMaterial } from '../../domain/library';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
import { QuestionBankTab } from './components/QuestionBankTab';
import { QuizCatalogTab } from './components/QuizCatalogTab';
import { useQuestionManagement } from './hooks/useQuestionManagement';
import { useQuizBuilder } from './hooks/useQuizBuilder';

const styles = stylex.create({
    tabBar: {
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        borderBottom: '1px solid #e5e4e7',
        paddingBottom: 0,
    },
    tab: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 16px',
        fontSize: 14,
        fontWeight: 500,
        color: '#6b6375',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        borderBottom: '2px solid transparent',
        marginBottom: -1,
    },
    tabActive: {
        color: '#6366f1',
        borderBottomColor: '#6366f1',
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        color: '#6b6375',
        fontSize: 14,
    },
});

type Tab = 'questions' | 'quizzes';

interface QuizManagementScreenProps {
    material: StudyMaterial;
    onBack: () => void;
}

export default function QuizManagementScreen({ material, onBack }: QuizManagementScreenProps) {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('QuizManagementScreen must be used within a <RepositoryProvider>');
    }

    const [activeTab, setActiveTab] = useState<Tab>('questions');
    const materialId = material.id;

    const { data: questions = [], isLoading: questionsLoading } = useQuery({
        queryKey: ['assessment', 'questions', materialId],
        queryFn: ({ signal }) => context.questionRepository.getQuestions(materialId, signal),
    });

    const { data: quizzes = [], isLoading: quizzesLoading } = useQuery({
        queryKey: ['assessment', 'quizzes', materialId],
        queryFn: ({ signal }) => context.quizRepository.getQuizzes(materialId, signal),
    });

    const questionMgmt = useQuestionManagement(materialId);
    const quizBuilder = useQuizBuilder(materialId);

    const backAction = (
        <Button
            label="Back to Library"
            variant="secondary"
            icon={<ArrowLeft size={16} />}
            onClick={onBack}
        >
            Back to Library
        </Button>
    );

    if (questionsLoading || quizzesLoading) {
        return (
            <Page title={`Manage: ${material.title}`} actions={backAction}>
                <div {...stylex.props(styles.loading)}>Loading…</div>
            </Page>
        );
    }

    return (
        <Page title={`Manage: ${material.title}`} actions={backAction}>
            <div {...stylex.props(styles.tabBar)}>
                <button
                    type="button"
                    onClick={() => setActiveTab('questions')}
                    {...stylex.props(styles.tab, activeTab === 'questions' && styles.tabActive)}
                >
                    <Library size={15} />
                    Question Bank
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('quizzes')}
                    {...stylex.props(styles.tab, activeTab === 'quizzes' && styles.tabActive)}
                >
                    <ListChecks size={15} />
                    Quiz Catalog
                </button>
            </div>

            {activeTab === 'questions' && (
                <QuestionBankTab
                    questions={questions}
                    materialId={materialId}
                    onCreate={(input) => questionMgmt.createQuestion.mutate(input)}
                    onUpdate={(id, input) => questionMgmt.updateQuestion.mutate({ id, input })}
                    onPublish={(id) => questionMgmt.publishQuestion.mutate(id)}
                    onArchive={(id) => questionMgmt.archiveQuestion.mutate(id)}
                />
            )}

            {activeTab === 'quizzes' && (
                <QuizCatalogTab
                    quizzes={quizzes}
                    questions={questions}
                    materialId={materialId}
                    onCreate={(input, qs) => quizBuilder.createQuiz.mutate({ input, questions: qs })}
                    onUpdate={(id, input) => quizBuilder.updateQuiz.mutate({ id, input })}
                    onPublish={(id) => quizBuilder.publishQuiz.mutate(id)}
                    onArchive={(id) => quizBuilder.archiveQuiz.mutate(id)}
                />
            )}
        </Page>
    );
}
