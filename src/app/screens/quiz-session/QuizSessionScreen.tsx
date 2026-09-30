import QuizTab from '../../../features/quiz/QuizTab';

export interface QuizSessionScreenProps {
  quizId: string;
  materialIds: string[];
  quizIds?: string[];
  onExit: () => void;
}

export function QuizSessionScreen({
  quizId,
  materialIds,
  quizIds,
  onExit,
}: QuizSessionScreenProps) {
  return (
    <QuizTab
      quizId={quizId}
      materialIds={materialIds}
      quizIds={quizIds}
      onExit={onExit}
      embedded={false}
    />
  );
}

export default QuizSessionScreen;
