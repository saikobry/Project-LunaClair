import type { Question, QuestionStatus } from '../../../domain/quiz/Question';
import type {
  QuestionRepository,
  CreateQuestionInput,
} from '../../../domain/quiz/QuestionRepository';
import type { GeneratedFlashcardDraft } from '../../../domain/generator/generator.types';

export interface BatchCreateFlashcardsInput {
  materialId: string;
  flashcards: GeneratedFlashcardDraft[];
  status?: QuestionStatus;
}

/**
 * Atomically creates a batch of AI-generated flashcards as canonical identification questions in IndexedDB.
 * Defaults to 'draft' status.
 */
export class BatchCreateFlashcardsUseCase {
  private readonly questionRepository: QuestionRepository;

  constructor(questionRepository: QuestionRepository) {
    this.questionRepository = questionRepository;
  }

  async execute(input: BatchCreateFlashcardsInput): Promise<Question[]> {
    if (!input.flashcards || input.flashcards.length === 0) {
      return [];
    }

    const createInputs: CreateQuestionInput[] = input.flashcards.map((draft) => {
      const tags = Array.from(new Set(['flashcard', 'ai-generated', ...(draft.tags || [])]));
      return {
        materialId: input.materialId,
        type: 'identification',
        prompt: draft.front,
        payload: {
          type: 'identification',
          correctAnswer: draft.back,
        },
        difficulty: 'medium',
        points: 1,
        explanation: draft.explanation,
        tags,
        status: input.status ?? 'draft',
      };
    });

    return this.questionRepository.createQuestionsBatch(createInputs);
  }
}
