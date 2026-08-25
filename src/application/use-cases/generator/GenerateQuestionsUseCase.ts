import type { AiService } from '../../../domain/ai/AiService';
import type {
  GenerateQuestionsRequest,
  GeneratedQuestionDraft,
} from '../../../domain/generator/generator.types';
import { validateQuestionsDraftArray } from '../../../domain/generator/validation/questionDraftValidation';
import { extractSectionContext } from '../../../features/ai/lib/aiContextExtractor';

export class GenerateQuestionsUseCase {
  private readonly aiService: AiService;

  constructor(aiService: AiService) {
    this.aiService = aiService;
  }

  async execute(request: GenerateQuestionsRequest): Promise<GeneratedQuestionDraft[]> {
    const count = Math.max(1, Math.min(10, request.count ?? 5));
    const difficulty = request.difficulty ?? 'all';
    const allowedTypes =
      request.types && request.types.length > 0
        ? request.types
        : ['multiple_choice', 'true_false', 'identification', 'fill_in_blank', 'multiple_select'];

    const { contextText, sectionHeading } = extractSectionContext(
      request.documentMarkdown,
      undefined,
      { maxCharacters: 12000 },
    );

    const systemPrompt = `You are an expert educational assessment author for Project LunaClair.
Your task is to generate ${count} high-quality, conceptual, and unambiguous assessment questions grounded strictly in the provided study material.

TARGET CRITERIA:
- Count: exactly ${count} questions
- Target Difficulty: ${difficulty === 'all' ? 'mixed (mix of easy, medium, hard)' : difficulty}
- Allowed Question Types: ${allowedTypes.join(', ')}
${request.focusTopic ? `- Specific Topic Focus: ${request.focusTopic}` : ''}

CRITICAL RULES:
1. Every question MUST be answerable from the provided study material.
2. Formulate clear, concise prompts without trivia.
3. For multiple choice/select, provide plausible, non-obvious distractors.
4. Output a STRICT JSON ARRAY of question objects without markdown code fences or conversational text.
5. QUOTATION RULE: Never use raw unescaped double quotes inside strings. Always use single quotes for terms, quotes, or code (e.g. 'hablar', 'yo').
6. Only use question types from the Allowed Question Types list above.

SCHEMA FORMATS BY TYPE:

- multiple_choice:
  {
    "type": "multiple_choice",
    "prompt": "What is the conjugation of 'hablar' for 'yo'?",
    "payload": {
      "type": "multiple_choice",
      "choices": ["hablo", "hablas", "habla", "hablamos"],
      "correctIndex": 0
    },
    "difficulty": "easy",
    "points": 1,
    "explanation": "'Hablar' is a regular -ar verb with 'yo' ending in -o."
  }

- true_false:
  {
    "type": "true_false",
    "prompt": "'Ser' is used to describe temporary conditions.",
    "payload": {
      "type": "true_false",
      "correctAnswer": false
    },
    "difficulty": "easy",
    "points": 1,
    "explanation": "'Estar' is used for temporary conditions, while 'ser' is for permanent traits."
  }

- identification:
  {
    "type": "identification",
    "prompt": "What Spanish verb means 'to eat'?",
    "payload": {
      "type": "identification",
      "correctAnswer": "comer",
      "acceptedAlternatives": ["Comer"]
    },
    "difficulty": "easy",
    "points": 1,
    "explanation": "'Comer' is the regular infinitive form meaning 'to eat'."
  }

- fill_in_blank:
  {
    "type": "fill_in_blank",
    "prompt": "Fill in the blank with the correct form of 'vivir' for 'nosotros'.",
    "payload": {
      "type": "fill_in_blank",
      "template": "Nosotros ___ en Madrid.",
      "blanks": ["vivimos"]
    },
    "difficulty": "medium",
    "points": 1,
    "explanation": "The 'nosotros' ending for regular -ir verbs is -imos."
  }

- multiple_select:
  {
    "type": "multiple_select",
    "prompt": "Which of the following are irregular verbs in Spanish?",
    "payload": {
      "type": "multiple_select",
      "choices": ["ir", "tener", "hablar", "comer"],
      "correctIndices": [0, 1]
    },
    "difficulty": "medium",
    "points": 2,
    "explanation": "'Ir' and 'tener' have irregular conjugations, while 'hablar' and 'comer' are regular."
  }`;

    const userPrompt = `Study Material Content:
---
${contextText}
---

Generate ${count} questions matching the schema.`;

    const rawDrafts = await this.aiService.generateStructured(
      {
        systemPrompt,
        userPrompt,
        temperature: 0.25,
        maxTokens: 3500,
        signal: request.signal,
      },
      validateQuestionsDraftArray,
    );

    // Apply provenance and section metadata
    return rawDrafts.map((draft) => {
      const tags = Array.from(
        new Set(['ai-generated', ...(draft.tags || []), ...(sectionHeading ? [`sec:${sectionHeading}`] : [])]),
      );
      return {
        ...draft,
        tags,
        sourceSection: sectionHeading || draft.sourceSection,
      };
    });
  }
}
