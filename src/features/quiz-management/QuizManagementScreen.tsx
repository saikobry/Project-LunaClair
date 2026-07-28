import { useState, useContext, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Library, ListChecks } from 'lucide-react';
import { RepositoryContext } from '../../app/providers/RepositoryContext';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
import { useMaterial } from '../../shared/hooks/useMaterial';
import { useTabKeyboardNavigation } from '../../shared/hooks/useTabKeyboardNavigation';
import { QuestionBankTab } from './components/QuestionBankTab';
import { QuizCatalogTab } from './components/QuizCatalogTab';
import { useQuestionManagement } from './hooks/useQuestionManagement';
import { useQuizBuilder } from './hooks/useQuizBuilder';

// ── Module-scoped static values (hoisted for stable references) ──

type MgmtTab = 'questions' | 'quizzes';

const MGMT_TABS: { key: MgmtTab; label: string; icon: typeof Library }[] = [
    { key: 'questions', label: 'Question Bank', icon: Library },
    { key: 'quizzes', label: 'Quiz Catalog', icon: ListChecks },
];

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
    materialId: string;
    onBack: () => void;
}

export default function QuizManagementScreen({ materialId, onBack }: QuizManagementScreenProps) {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('QuizManagementScreen must be used within a <RepositoryProvider>');
    }

    const { material, isLoading: materialLoading } = useMaterial(materialId);

    const [activeTab, setActiveTab] = useState<Tab>('questions');

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

    // Hooks must be called before any early returns (rules-of-hooks)
    const tabListRef = useRef<HTMLDivElement>(null);
    const tabKeyboard = useTabKeyboardNavigation({
        tabs: ['questions', 'quizzes'] as const,
        activeTab,
        onTabChange: setActiveTab,
    });

    const backAction = (
        <Button
            label="Back"
            variant="secondary"
            icon={<ArrowLeft size={16} />}
            onClick={onBack}
        >
            Back
        </Button>
    );

    const pageTitle = material?.title
        ? `Manage: ${material.title}`
        : materialLoading
            ? 'Loading…'
            : 'Manage Material';

    if (materialLoading || questionsLoading || quizzesLoading) {
        return (
            <Page title={pageTitle} actions={backAction}>
                <div {...stylex.props(styles.loading)}>Loading…</div>
            </Page>
        );
    }

    return (
        <Page title={pageTitle} actions={backAction}>
            <div
                ref={tabListRef}
                role="tablist"
                aria-label="Quiz Management tabs"
                onKeyDown={tabKeyboard.handleKeyDown}
                {...stylex.props(styles.tabBar)}
            >
                {MGMT_TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === key}
                        aria-controls={`mgmt-panel-${key}`}
                        tabIndex={activeTab === key ? 0 : -1}
                        onClick={() => setActiveTab(key)}
                        {...stylex.props(styles.tab, activeTab === key && styles.tabActive)}
                    >
                        <Icon size={15} />
                        {label}
                    </button>
                ))}
            </div>

            <div
                role="tabpanel"
                id={`mgmt-panel-${activeTab}`}
                aria-labelledby={activeTab}
            >
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
            </div>
        </Page>
    );
}
