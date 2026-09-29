import type { AiService } from '../../../domain/ai/services/AiService';
import type {
  GenerateQuestionsRequest,
  GeneratedQuestionDraft,
} from '../../../domain/generator/models/generator.types';
import type { QuestionType } from '../../../domain/quiz/models/QuestionType';
import { AiGenerationError } from '../../../domain/ai/models/ai.types';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';
import {
  validateQuestionsDraftArray,
  type DraftBatch,
} from '../../../domain/generator/validation/questionDraftValidation';
import { extractSectionContext } from '../../../domain/ai/context/extractSectionContext';
import type { AiGroundingResolver } from '../ai/AiGroundingResolver';

// Only the schemas for the types a request allows are sent. Bombarding the model with formats it
// cannot use gives it more to imitate, lengthens the prompt, and the tail of a long output is where
// it degenerates — observed there: a dropped `true_false` prefix (`_false`) and an omitted
// `correctIndex`. Showing fewer formats is also a plain instruction-following aid.
const SCHEMA_BY_TYPE: Record<QuestionType, string> = {
  multiple_choice: `- multiple_choice:
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
    "tags": ["verb conjugation", "present tense"],
    "explanation": "'Hablar' is a regular -ar verb with 'yo' ending in -o."
  }`,
  true_false: `- true_false:
  {
    "type": "true_false",
    "prompt": "'Ser' is used to describe temporary conditions.",
    "payload": {
      "type": "true_false",
      "correctAnswer": false
    },
    "difficulty": "easy",
    "points": 1,
    "tags": ["ser vs estar", "verb usage"],
    "explanation": "'Estar' is used for temporary conditions, while 'ser' is for permanent traits."
  }`,
  identification: `- identification:
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
    "tags": ["vocabulary", "infinitive verbs"],
    "explanation": "'Comer' is the regular infinitive form meaning 'to eat'."
  }`,
  fill_in_blank: `- fill_in_blank:
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
    "tags": ["verb conjugation", "present tense"],
    "explanation": "The 'nosotros' ending for regular -ir verbs is -imos."
  }`,
  multiple_select: `- multiple_select:
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
    "tags": ["irregular verbs", "verb classification"],
    "explanation": "'Ir' and 'tener' have irregular conjugations, while 'hablar' and 'comer' are regular."
  }`,
};

export class GenerateQuestionsUseCase {
  private readonly aiService: AiService;
  private readonly groundingResolver: AiGroundingResolver;

  constructor(aiService: AiService, groundingResolver: AiGroundingResolver) {
    this.aiService = aiService;
    this.groundingResolver = groundingResolver;
  }

  async execute(request: GenerateQuestionsRequest): Promise<DraftBatch<GeneratedQuestionDraft>> {
    const count = Math.max(1, Math.min(10, request.count ?? 5));
    const difficulty = request.difficulty ?? 'all';
    const allowedTypes: QuestionType[] =
      request.types && request.types.length > 0
        ? request.types
        : ['multiple_choice', 'true_false', 'identification', 'fill_in_blank', 'multiple_select'];

    // The source document comes from the material, through the same resolver the chat path uses —
    // one path, so synthesis cannot run against content the reader would not have been offered.
    // Generation is always whole-material (there is no thread to carry a per-conversation mode).
    const snapshot = await this.groundingResolver.resolve(
      { materialId: request.materialId, grounding: 'whole' },
      { model: request.model, signal: request.signal },
    );
    const sourceMarkdown = snapshot.documentContext?.markdown;
    if (!sourceMarkdown) {
      throw new AiGenerationError(
        'This material has no readable content to generate questions from.',
        'EMPTY_DOCUMENT',
      );
    }

    // Budgets are facts about the served model, not constants: the resolver has already capped the
    // document to this model's `maxDocumentContextChars`, and the output reservation is what the
    // request may ask the provider for.
    const descriptor = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, request.model);

    const { contextText, sectionHeading } = extractSectionContext(
      sourceMarkdown,
      undefined,
      { maxCharacters: descriptor.maxDocumentContextChars },
    );

    const schemaSection = allowedTypes.map((type) => SCHEMA_BY_TYPE[type]).join('\n\n');

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
7. FIELD COMPLETENESS: every object must carry \`type\`, \`prompt\`, \`difficulty\`, \`points\`, and \`payload\`. Emit no property with an empty value — \`"correctIndex":\` followed by nothing is invalid and the question is discarded.
8. EXACT TYPE LITERALS: copy the type strings character for character, in BOTH the top-level \`type\` and \`payload.type\`. Write \`true_false\` — never \`_false\`, \`false\`, or \`true\`.
9. COMPLETE ANSWERS: \`correctIndex\` and \`correctIndices\` must be zero-based integers pointing at a real choice, and \`correctAnswer\` / \`blanks\` must be non-empty. A question with no determinable answer is discarded.
10. Output exactly ${count} objects, then stop. Add no commentary before or after the array.
11. TAGS: give every question 2-4 short topic tags (lowercase, one to three words) naming the subject matter it tests, drawn from the material — these are how a user classifies the question later. Never tag a question with how it was produced (for example 'ai', 'generated', or 'flashcard').
${allowedTypes.includes('fill_in_blank') ? `12. CLOZE ATOMICITY: each \`___\` in a \`fill_in_blank\` template becomes its own flashcard with its own review schedule, so every blank must stand alone as ONE discrete, high-yield fact. Keep the template short and put the tested fact in the blank — the surrounding words are retrieval context, not the question. Supply exactly one non-empty entry in \`blanks\` per \`___\`, in left-to-right order; a blank with no supplied answer, or an answer count that disagrees with the marker count, discards the item.\n` : ''}
SCHEMA FORMATS BY TYPE (only the allowed types listed above):

${schemaSection}`;

    const userPrompt = `Study Material Content:
---
${contextText}
---

Generate ${count} questions matching the schema.`;

    const rawBatch = await this.aiService.generateStructured(
      {
        systemPrompt,
        userPrompt,
        temperature: 0.25,
        maxTokens: descriptor.maxOutputTokens,
        model: request.model,
        signal: request.signal,
      },
      validateQuestionsDraftArray,
    );

    // Tags are classification, not provenance. Nothing is stamped on top of the model's own topic
    // tags: an `ai-generated` marker does not help anyone find or group a question, and a `sec:`
    // marker duplicated the section the draft already carries. `sourceSection` is the real record
    // of where the question came from — a dedicated optional field on `Question`, not a tag — and
    // `BatchCreateQuestionsUseCase` persists it as-is.
    return {
      drafts: rawBatch.drafts.map((draft) => ({
        ...draft,
        tags: draft.tags ?? [],
        sourceSection: sectionHeading || draft.sourceSection,
      })),
      rejected: rawBatch.rejected,
    };
  }
}
