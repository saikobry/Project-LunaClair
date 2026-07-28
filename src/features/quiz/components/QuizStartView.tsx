import * as stylex from '@stylexjs/stylex';
import { Play, HelpCircle, Layers } from 'lucide-react';
import type { Quiz } from '../../../domain/quiz/Quiz';
import type { Question } from '../../../domain/quiz/Question';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';

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
});

interface QuizStartViewProps {
  title: string;
  quizzes: Quiz[];
  allQuestions: Question[];
  onStartQuiz: (quizId?: string) => void;
}

export function QuizStartView({
  title,
  quizzes,
  allQuestions,
  onStartQuiz,
}: QuizStartViewProps) {
  const isMultiple = quizzes.length > 1;
  const singleQuiz = quizzes[0];
  const totalQuestionsCount = allQuestions.length > 0 ? allQuestions.length : (singleQuiz?.questionIds.length ?? 0);

  return (
    <div {...stylex.props(styles.container)}>
      <div {...stylex.props(styles.headerCard)}>
        <div {...stylex.props(styles.iconBadge)}>
          <HelpCircle size={24} />
        </div>
        <h2 {...stylex.props(styles.title)}>{title}</h2>
        <p {...stylex.props(styles.description)}>
          Test your knowledge and reinforce key concepts from this study material.
        </p>

        <div {...stylex.props(styles.metaGrid)}>
          <div {...stylex.props(styles.metaBadge)}>
            <HelpCircle size={15} />
            <span>{totalQuestionsCount} Questions</span>
          </div>
          <div {...stylex.props(styles.metaBadge)}>
            <Layers size={15} />
            <span>{quizzes.length} {quizzes.length === 1 ? 'Quiz' : 'Quizzes'}</span>
          </div>
        </div>

        {!isMultiple && (
          <div style={{ marginTop: 16 }}>
            <Button
              label="Start quiz"
              variant="primary"
              icon={<Play size={16} />}
              onClick={() => onStartQuiz(singleQuiz?.id)}
            >
              Start Quiz
            </Button>
          </div>
        )}
      </div>

      {isMultiple && (
        <div {...stylex.props(styles.quizList)}>
          <h3 {...stylex.props(styles.sectionTitle)}>Available Quizzes ({quizzes.length})</h3>
          {quizzes.map((quiz, index) => {
            const questionCount = quiz.questionIds.length;
            return (
              <Card key={quiz.id}>
                <div {...stylex.props(styles.quizCard)}>
                  <div {...stylex.props(styles.quizInfo)}>
                    <h4 {...stylex.props(styles.quizTitle)}>
                      {quiz.title || `Quiz ${index + 1}`}
                    </h4>
                    <span {...stylex.props(styles.quizMeta)}>
                      {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                    </span>
                  </div>
                  <Button
                    label={`Start ${quiz.title || `Quiz ${index + 1}`}`}
                    variant="primary"
                    icon={<Play size={14} />}
                    onClick={() => onStartQuiz(quiz.id)}
                  >
                    Start
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
