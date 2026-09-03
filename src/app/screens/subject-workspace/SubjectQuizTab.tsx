import { SubjectQuizExplorer } from '../../../features/quiz/components/SubjectQuizExplorer';
import { useSubjectQuizTree } from '../../../features/quiz/hooks/queries/useSubjectQuizTree';
import { useQuizTreeSelection } from '../../../features/quiz/hooks/queries/useQuizTreeSelection';
import type { QuizLaunchRequest } from '../../../features/quiz/types/quizFeature.types';

interface SubjectQuizTabProps {
  subjectId: string;
  onStartQuiz: (request: QuizLaunchRequest) => void;
}

export function SubjectQuizTab({
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

export default SubjectQuizTab;
