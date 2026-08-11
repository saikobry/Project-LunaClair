// Domain models
export type { QuestionType } from './QuestionType';
export type { QuizMode } from './QuizMode';
export type {
    QuestionAnswerPayload,
    MultipleChoicePayload,
    MultipleSelectPayload,
    TrueFalsePayload,
    IdentificationPayload,
    FillBlankPayload,
    PayloadForType,
} from './AnswerPayload';
export type { Question, QuestionDifficulty, QuestionStatus } from './Question';
export type { Quiz, QuizStatus, QuizQuestion } from './Quiz';
export type { SubmittedAnswer } from './Answer';
export type { QuizSession, QuizScore, QuizSessionStatus } from './QuizSession';

// Repository contracts
export type {
    QuestionRepository,
    CreateQuestionInput,
    UpdateQuestionInput,
} from './QuestionRepository';
export type {
    QuizRepository,
    CreateQuizInput,
    UpdateQuizInput,
} from './QuizRepository';
export type {
    QuizSessionRepository,
    CreateSessionInput,
} from './QuizSessionRepository';

// Strategies
export type { QuestionStrategy, GradeResult } from './strategies/QuestionStrategy';
export { MultipleChoiceStrategy } from './strategies/MultipleChoiceStrategy';
export { MultipleSelectStrategy } from './strategies/MultipleSelectStrategy';
export { TrueFalseStrategy } from './strategies/TrueFalseStrategy';
export { IdentificationStrategy } from './strategies/IdentificationStrategy';
export { FillBlankStrategy } from './strategies/FillBlankStrategy';
export { resolveStrategy } from './strategies/QuestionStrategyResolver';

// Virtual quiz
export { buildUnifiedQuestionSetFromQuizzes, createVirtualQuizFromQuizzes } from './virtualQuiz';

// Badge appearance (semantic palette shared by authoring + learner surfaces)
export { QUESTION_TYPE_APPEARANCE, DIFFICULTY_APPEARANCE, POINTS_APPEARANCE } from './quizBadgeAppearance';

// Quiz editor service contract (atomic authoring saves)
export type {
    QuizEditorService,
    QuizEditorQuestionChange,
    SaveQuizToRepositoryInput,
    SaveQuizToRepositoryResult,
} from './QuizEditorService';

// Assessment service
export { AssessmentService, assessmentService } from './AssessmentService';
export type { QuizResult } from './AssessmentService';
