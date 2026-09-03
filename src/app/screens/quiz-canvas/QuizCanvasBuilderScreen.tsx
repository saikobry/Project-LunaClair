import { QuizCanvasBuilder } from '../../../features/quiz-management/canvas/QuizCanvasBuilder';

export interface QuizCanvasBuilderScreenProps {
  materialId: string;
  quizId?: string;
  bottomInset: number;
  onClose: () => void;
}

export function QuizCanvasBuilderScreen({
  materialId,
  quizId,
  bottomInset,
  onClose,
}: QuizCanvasBuilderScreenProps) {
  return (
    <QuizCanvasBuilder
      key={quizId ?? 'new-quiz'}
      materialId={materialId}
      quizId={quizId}
      bottomInset={bottomInset}
      onClose={onClose}
    />
  );
}

export default QuizCanvasBuilderScreen;
