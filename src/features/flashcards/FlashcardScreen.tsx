import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQueryClient } from '@tanstack/react-query';

import { useQuestions } from '../quiz/hooks/queries/useQuestions';
import { useQuizzes } from '../quiz/hooks/queries/useQuizzes';
import { useFlashcardReviews } from './hooks/queries/useFlashcardReviews';
import { useFlashcardRating } from './hooks/mutations/useFlashcardRating';
import { useMaterial } from '../catalog/materials/hooks/queries/useMaterial';
import { useDocument } from '../reader/hooks/useDocument';
import { useToast } from '../../app/providers/ToastContext';
import { orderDeck, type DeckStudyMode } from '../../domain/flashcards/deck';
import type { Flashcard } from '../../domain/flashcards/Card';
import type { Rating } from '../../domain/flashcards/scheduler';
import type { FlashcardViewStep, FlashcardSessionSummary } from './types/flashcardFeature.types';
import { FlashcardDeckSetupView } from './components/FlashcardDeckSetupView';
import { FlashcardPlayerView } from './components/FlashcardPlayerView';
import { FlashcardSessionEndView } from './components/FlashcardSessionEndView';
import { AiFlashcardGeneratorDialog } from '../generator/components/AiFlashcardGeneratorDialog';
import { useExportStudyPackage } from '../package/hooks/useExportStudyPackage';
import { ShareStudyPackageModal } from '../package/components/ShareStudyPackageModal';

const styles = stylex.create({
    container: {
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    loadingState: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        fontSize: 14,
        color: 'var(--color-text-secondary)',
    },
});

interface FlashcardScreenProps {
    materialId: string;
}

const INITIAL_SUMMARY: FlashcardSessionSummary = {
    totalReviewed: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
};

export function FlashcardScreen({ materialId }: FlashcardScreenProps) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { questions, isLoading: loadingQuestions } = useQuestions(materialId);
    const { quizzes, isLoading: loadingQuizzes } = useQuizzes(materialId);
    const { reviews, isLoading: loadingReviews } = useFlashcardReviews(materialId);
    const { recordRating } = useFlashcardRating(materialId);
    const { material, isLoading: loadingMaterial } = useMaterial(materialId);
    const { data: doc, isLoading: loadingDoc } = useDocument(material);
    const { exportPackage, isExporting } = useExportStudyPackage();

    const [step, setStep] = useState<FlashcardViewStep>('setup');
    const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [deck, setDeck] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [summary, setSummary] = useState<FlashcardSessionSummary>(INITIAL_SUMMARY);

    const isLoading = loadingQuestions || loadingQuizzes || loadingReviews || loadingMaterial || loadingDoc;

    const handleStartSession = (selectedQuizId?: string, studyMode?: DeckStudyMode) => {
        let pool = questions.filter((q) => q.status !== 'archived');

        if (selectedQuizId) {
            const targetQuiz = quizzes.find((q) => q.id === selectedQuizId);
            if (targetQuiz) {
                const idSet = new Set(targetQuiz.questionIds);
                pool = pool.filter((q) => idSet.has(q.id));
            }
        }

        const ordered = orderDeck(pool, reviews, new Date(), { studyMode });
        if (ordered.length === 0) return;

        setDeck(ordered);
        setCurrentIndex(0);
        setSummary(INITIAL_SUMMARY);
        setStep('session');
    };

    const handleRating = async (card: Flashcard, rating: Rating) => {
        // Persist immediately via optimistic mutation hook
        await recordRating({
            key: card.key,
            materialId,
            existingState: reviews[card.key],
            rating,
        });

        // Update summary counter
        setSummary((prev) => ({
            ...prev,
            totalReviewed: prev.totalReviewed + 1,
            againCount: rating === 'again' ? prev.againCount + 1 : prev.againCount,
            hardCount: rating === 'hard' ? prev.hardCount + 1 : prev.hardCount,
            goodCount: rating === 'good' ? prev.goodCount + 1 : prev.goodCount,
            easyCount: rating === 'easy' ? prev.easyCount + 1 : prev.easyCount,
        }));

        if (currentIndex + 1 < deck.length) {
            setCurrentIndex((idx) => idx + 1);
        } else {
            setStep('summary');
        }
    };

    const handleExit = () => {
        setStep('setup');
    };

    const handleRestudy = () => {
        setStep('setup');
    };

    if (isLoading) {
        return (
            <div {...stylex.props(styles.loadingState)}>
                Loading flashcards deck...
            </div>
        );
    }

    return (
        <div {...stylex.props(styles.container)}>
            {step === 'setup' && (
                <FlashcardDeckSetupView
                    questions={questions}
                    quizzes={quizzes}
                    reviews={reviews}
                    onStartSession={handleStartSession}
                    onGenerateAi={() => setAiGeneratorOpen(true)}
                    onExport={() => exportPackage(materialId)}
                    isExporting={isExporting}
                    onShare={() => setIsShareOpen(true)}
                />
            )}

            {step === 'session' && (
                <FlashcardPlayerView
                    deck={deck}
                    currentIndex={currentIndex}
                    onRating={handleRating}
                    onExit={handleExit}
                />
            )}

            {step === 'summary' && (
                <FlashcardSessionEndView
                    summary={summary}
                    onRestudy={handleRestudy}
                    onDone={() => setStep('setup')}
                />
            )}

            {aiGeneratorOpen && (
                <AiFlashcardGeneratorDialog
                    isOpen={aiGeneratorOpen}
                    onClose={() => setAiGeneratorOpen(false)}
                    materialId={materialId}
                    materialTitle={material?.title || 'Study Material'}
                    documentMarkdown={doc?.content || ''}
                    onSuccess={(count) => {
                        showToast(`Added ${count} flashcards to your deck`, { intent: 'success' });
                        queryClient.invalidateQueries({ queryKey: ['assessment', 'questions', materialId] });
                    }}
                />
            )}

            <ShareStudyPackageModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                materialId={materialId}
                materialTitle={material?.title || 'Flashcards'}
            />
        </div>
    );
}
