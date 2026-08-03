import { SubjectQuizExplorer } from '../../quiz/components/SubjectQuizExplorer/SubjectQuizExplorer';
import { useSubjectQuizTree } from '../../quiz/hooks/useSubjectQuizTree';
import { useQuizTreeSelection } from '../../quiz/hooks/useQuizTreeSelection';
import type { QuizLaunchRequest } from '../../quiz/types/quizFeature.types';

interface SubjectQuizTabProps {
  subjectId: string;
  onStartQuiz: (request: QuizLaunchRequest) => void;
}

export default function SubjectQuizTab({
  subjectId,
  onStartQuiz,
}: SubjectQuizTabProps) {
  const { terms, isLoading } = useSubjectQuizTree(subjectId);
  const selection = useQuizTreeSelection(terms);

  const handleStartSingleQuiz = (quizId: string) => {
    onStartQuiz({ type: 'quiz', quizId, source: 'library' });
  };

  const handleStartUnifiedQuiz = (quizIds: string[]) => {
    onStartQuiz({ type: 'quizzes', quizIds, subjectId, source: 'library' });
  };

  return (
    <SubjectQuizExplorer
      tree={terms}
      selection={selection}
      isLoading={isLoading}
      onStartSingleQuiz={handleStartSingleQuiz}
      onStartUnifiedQuiz={handleStartUnifiedQuiz}
    />
  );
}
