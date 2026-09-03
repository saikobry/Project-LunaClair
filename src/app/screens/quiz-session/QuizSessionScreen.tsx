import QuizScreen from '../../../features/quiz/QuizScreen';

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
    <QuizScreen
      quizId={quizId}
      materialIds={materialIds}
      quizIds={quizIds}
      onExit={onExit}
      embedded={false}
    />
  );
}

export default QuizSessionScreen;
