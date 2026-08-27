import { useState, useContext } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Library, ListChecks, Package, Share2 } from 'lucide-react';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import type { AppRoute } from '../../app/layouts/AppShell';
import { useMaterial } from '../catalog/materials/hooks/queries/useMaterial';
import { useDocument } from '../reader/hooks/useDocument';
import { useExportStudyPackage } from '../package/hooks/useExportStudyPackage';
import { ShareStudyPackageModal } from '../package/components/ShareStudyPackageModal';
import { Button } from '../../shared/ui/Button/Button';
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
    headerRow: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
    },
    tabListWrapper: {
        flex: 1,
        minWidth: 280,
    },
    exportButton: {
        marginTop: 2,
    },
});

type Tab = 'questions' | 'quizzes';

interface QuizManagementScreenProps {
    materialId: string;
    onNavigate: (route: AppRoute) => void;
}

export default function QuizManagementScreen({ materialId, onNavigate }: QuizManagementScreenProps) {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('QuizManagementScreen must be used within a <ApplicationProvider>');
    }

    const queryClient = useQueryClient();
    const { material, isLoading: materialLoading } = useMaterial(materialId);
    const { data: doc, isLoading: docLoading } = useDocument(material);

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
    const { exportPackage, isExporting } = useExportStudyPackage();
    const [isShareOpen, setIsShareOpen] = useState(false);

    if (materialLoading || questionsLoading || quizzesLoading || docLoading) {
        return (
            <div {...stylex.props(styles.loading)}>Loading…</div>
        );
    }

    return (
        <>
            <div {...stylex.props(styles.headerRow)}>
                <div {...stylex.props(styles.tabListWrapper)}>
                    <TabList value={activeTab} onChange={(tab) => setActiveTab(tab as Tab)} layout="fill" hasDivider aria-label="Quiz Management tabs">
                        {MGMT_TABS.map(({ key, label, icon: Icon }) => (
                            <Tab key={key} value={key} label={label} icon={<Icon size={15} />} />
                        ))}
                    </TabList>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <Button
                        label="Share"
                        variant="secondary"
                        icon={<Share2 size={15} />}
                        onClick={() => setIsShareOpen(true)}
                    >
                        Share
                    </Button>
                    <Button
                        label="Export as .lcpack"
                        variant="secondary"
                        icon={<Package size={15} />}
                        onClick={() => exportPackage(materialId)}
                        isLoading={isExporting}
                        isDisabled={isExporting}
                    >
                        Export as .lcpack
                    </Button>
                </div>
            </div>

            <AnimatedTabPanel activeKey={activeTab}>
                {activeTab === 'questions' && (
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

                {activeTab === 'quizzes' && (
                    <QuizCatalogTab
                        quizzes={quizzes}
                        materialId={materialId}
                        onNavigate={onNavigate}
                        onPublish={(id) => quizBuilder.publishQuiz.mutate(id)}
                        onArchive={(id) => quizBuilder.archiveQuiz.mutate(id)}
                        onUnarchive={(id) => quizBuilder.unarchiveQuiz.mutate(id)}
                    />
                )}
            </AnimatedTabPanel>

            <ShareStudyPackageModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                materialId={materialId}
                materialTitle={material?.title ?? 'Quiz Management'}
            />
        </>
    );
}
