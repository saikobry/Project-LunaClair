import type { Question, QuestionStatus } from '../../../domain/quiz/models/Question';
import type {
  QuestionRepository,
  CreateQuestionInput,
} from '../../../domain/quiz/repositories/QuestionRepository';
import type { GeneratedQuestionDraft } from '../../../domain/generator/models/generator.types';

export interface BatchCreateQuestionsInput {
  materialId: string;
  questions: GeneratedQuestionDraft[];
  status?: QuestionStatus;
}

/**
 * Atomically creates a batch of AI-generated questions in IndexedDB.
 * Defaults to 'draft' status for human review before publishing.
 */
export class BatchCreateQuestionsUseCase {
  private readonly questionRepository: QuestionRepository;

  constructor(questionRepository: QuestionRepository) {
    this.questionRepository = questionRepository;
  }

  async execute(input: BatchCreateQuestionsInput): Promise<Question[]> {
    if (!input.questions || input.questions.length === 0) {
      return [];
    }

    const createInputs: CreateQuestionInput[] = input.questions.map((draft) => {
      // Tags are whatever classification the draft carries — persistence adds no provenance marker.
      return {
        materialId: input.materialId,
        type: draft.type,
        prompt: draft.prompt,
        payload: draft.payload,
        difficulty: draft.difficulty,
        points: draft.points,
        explanation: draft.explanation,
        tags: draft.tags ?? [],
        status: input.status ?? 'draft',
      };
    });

    return this.questionRepository.createQuestionsBatch(createInputs);
  }
}
