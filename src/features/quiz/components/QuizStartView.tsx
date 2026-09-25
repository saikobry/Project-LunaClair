import * as stylex from '@stylexjs/stylex';
import { Play, HelpCircle, Layers } from 'lucide-react';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { Question } from '../../../domain/quiz/models/Question';
import { Button } from '../../../shared/ui/Button/Button';
import { Card } from '../../../shared/ui/Card/Card';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    maxWidth: 720,
    width: '100%',
    margin: '0 auto',
    padding: '24px 16px',
    boxSizing: 'border-box',
  },
  headerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    textAlign: 'center',
  },
  iconBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  description: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.5,
  },
  metaGrid: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    padding: '6px 12px',
    borderRadius: 8,
    backgroundColor: 'var(--color-background-muted)',
  },
  metaBadgeClickable: {
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-accent-muted)',
      color: 'var(--color-accent)',
    },
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: '12px 0 4px 0',
  },
  quizList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  quizCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  quizInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  quizMeta: {
    fontSize: 12,
    color: 'var(--color-text-disabled)',
  },
  draftBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    backgroundColor: 'var(--color-warning-muted)',
    color: 'var(--color-on-warning-muted)',
    borderRadius: 4,
    lineHeight: 1.4,
    marginLeft: 6,
  },
});

interface QuizStartViewProps {
  title: string;
  quizzes: Quiz[];
  allQuestions: Question[];
  isUnified?: boolean;
  onStartQuiz: (quizId?: string) => void;
  onOpenManagement?: () => void;
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function DraftBadge() {
  return <span {...stylex.props(styles.draftBadge)}>Draft</span>;
}

function QuestionBankBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  return (
    <div
      {...stylex.props(styles.metaBadge, onClick && styles.metaBadgeClickable)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      title={onClick ? 'Go to Question Bank management' : undefined}
    >
      <HelpCircle size={15} />
      <span>{pluralize(count, 'Question', 'Questions')} in Bank</span>
    </div>
  );
}

function QuizzesMetaBadge({ count, showDraft }: { count: number; showDraft: boolean }) {
  return (
    <div {...stylex.props(styles.metaBadge)}>
      <Layers size={15} />
      <span>
        {pluralize(count, 'Quiz', 'Quizzes')}
        {showDraft && <DraftBadge />}
      </span>
    </div>
  );
}

function QuizPickerList({ quizzes, isUnified, onStartQuiz }: { quizzes: Quiz[]; isUnified: boolean; onStartQuiz: (quizId?: string) => void }) {
  return (
    <div {...stylex.props(styles.quizList)}>
      <h3 {...stylex.props(styles.sectionTitle)}>
        {isUnified ? 'Included Quizzes' : 'Available Quizzes'}
      </h3>
      {quizzes.map((quiz, index) => {
        const questionCount = quiz.questionIds.length;
        return (
          <Card key={quiz.id}>
            <div {...stylex.props(styles.quizCard)} data-quiz-id={quiz.id}>
              <div {...stylex.props(styles.quizInfo)}>
                <h4 {...stylex.props(styles.quizTitle)}>
                  {quiz.title || `Quiz ${index + 1}`}
                </h4>
                <span {...stylex.props(styles.quizMeta)}>
                  {pluralize(questionCount, 'question', 'questions')}
                  {quiz.status === 'draft' && <DraftBadge />}
                </span>
              </div>
              {!isUnified && (
                <Button
                  label="Start quiz"
                  variant="primary"
                  icon={<Play size={15} />}
                  onClick={() => onStartQuiz(quiz.id)}
                >
                  Start Quiz
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function startQuizCopy(isUnified: boolean): { label: string; text: string } {
  if (isUnified) return { label: 'Start unified quiz', text: 'Start Unified Quiz' };
  return { label: 'Start quiz', text: 'Start Quiz' };
}

export function QuizStartView({
  title,
  quizzes,
  allQuestions,
  isUnified = false,
  onStartQuiz,
  onOpenManagement,
}: QuizStartViewProps) {
  const activeQuizzes = quizzes.filter((q) => q.status !== 'archived');
  const isMultiple = activeQuizzes.length > 1;
  const singleQuiz = activeQuizzes[0];
  const totalQuestionsCount = allQuestions.length > 0
    ? allQuestions.filter((q) => q.status !== 'archived').length
    : (singleQuiz?.questionIds.length ?? 0);

  // In material mode (isUnified = false) with multiple quizzes, users pick individual quizzes to start
  const showTopStartButton = isUnified || !isMultiple;
  const copy = startQuizCopy(isUnified);

  return (
    <div {...stylex.props(styles.container)}>
      <div {...stylex.props(styles.headerCard)}>
        <div {...stylex.props(styles.iconBadge)}>
          <HelpCircle size={24} />
        </div>
        <h2 {...stylex.props(styles.title)}>{title}</h2>
        <p {...stylex.props(styles.description)}>
          {!isUnified && isMultiple
            ? 'Select a quiz below to test your knowledge.'
            : 'Test your knowledge and reinforce key concepts from this study material.'}
        </p>

        <div {...stylex.props(styles.metaGrid)}>
          <QuestionBankBadge count={totalQuestionsCount} onClick={onOpenManagement} />
          <QuizzesMetaBadge count={activeQuizzes.length} showDraft={!isMultiple && singleQuiz?.status === 'draft'} />
        </div>

        {showTopStartButton && (
          <div style={{ marginTop: 16 }}>
            <Button
              label={copy.label}
              variant="primary"
              icon={<Play size={16} />}
              onClick={() => onStartQuiz(singleQuiz?.id)}
            >
              {copy.text}
            </Button>
          </div>
        )}
      </div>

      {isMultiple && (
        <QuizPickerList quizzes={activeQuizzes} isUnified={isUnified} onStartQuiz={onStartQuiz} />
      )}
    </div>
  );
}
