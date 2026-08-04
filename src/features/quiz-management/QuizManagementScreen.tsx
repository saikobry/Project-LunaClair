import { useState, useContext } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { Library, ListChecks } from 'lucide-react';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import { useMaterial } from '../catalog/materials/hooks/queries/useMaterial';
import { TabList, Tab } from '../../shared/ui/TabList/TabList';
import { AnimatedTabPanel } from '../../shared/ui/AnimatedTabPanel/AnimatedTabPanel';
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
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        color: 'var(--color-text-secondary)',
        fontSize: 14,
    },
});

type Tab = 'questions' | 'quizzes';

interface QuizManagementScreenProps {
    materialId: string;
}

export default function QuizManagementScreen({ materialId }: QuizManagementScreenProps) {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('QuizManagementScreen must be used within a <ApplicationProvider>');
    }

    const { isLoading: materialLoading } = useMaterial(materialId);

    const [activeTab, setActiveTab] = useState<Tab>('questions');

    const { data: questions = [], isLoading: questionsLoading } = useQuery({
        queryKey: ['assessment', 'questions', materialId],
        queryFn: ({ signal }) => context.questionRepository.getQuestions(materialId, signal),
    });

    const { data: quizzes = [], isLoading: quizzesLoading } = useQuery({
        queryKey: ['assessment', 'quizzes', materialId],
        queryFn: ({ signal }) => context.quizRepository.getQuizzes(materialId, signal),
    });

    const questionMgmt = useQuestionManagement();
    const quizBuilder = useQuizBuilder();

    if (materialLoading || questionsLoading || quizzesLoading) {
        return (
            <div {...stylex.props(styles.loading)}>Loading…</div>
        );
    }

    return (
        <>
            <TabList value={activeTab} onChange={(tab) => setActiveTab(tab as Tab)} layout="fill" hasDivider aria-label="Quiz Management tabs">
                {MGMT_TABS.map(({ key, label, icon: Icon }) => (
                    <Tab key={key} value={key} label={label} icon={<Icon size={15} />} />
                ))}
            </TabList>

            <AnimatedTabPanel activeKey={activeTab}>
                {activeTab === 'questions' && (
                    <QuestionBankTab
                        questions={questions}
                        quizzes={quizzes}
                        materialId={materialId}
                        onCreate={(input) => questionMgmt.createQuestion.mutate(input)}
                        onUpdate={(id, input) => questionMgmt.updateQuestion.mutate({ id, input })}
                        onPublish={(id) => questionMgmt.publishQuestion.mutate(id)}
                        onArchive={(id) => questionMgmt.archiveQuestion.mutate(id)}
                        onUnarchive={(id) => questionMgmt.unarchiveQuestion.mutate(id)}
                    />
                )}

                {activeTab === 'quizzes' && (
                    <QuizCatalogTab
                        quizzes={quizzes}
                        materialId={materialId}
                        onPublish={(id) => quizBuilder.publishQuiz.mutate(id)}
                        onArchive={(id) => quizBuilder.archiveQuiz.mutate(id)}
                        onUnarchive={(id) => quizBuilder.unarchiveQuiz.mutate(id)}
                    />
                )}
            </AnimatedTabPanel>
        </>
    );
}
