import { describe, it, expect } from 'vitest';
import { GenerateQuestionsUseCase } from '../GenerateQuestionsUseCase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../../domain/ai/services/aiModelCatalog';
import type { AiGenerationRequest } from '../../../../domain/ai/models/ai.types';
import type { AiGroundingResolver } from '../../ai/AiGroundingResolver';
import type { GeneratedQuestionDraft } from '../../../../domain/generator/models/generator.types';

describe('GenerateQuestionsUseCase', () => {
  const sampleMaterialMarkdown = `
# Biology 101: The Nervous System

## 1. Action Potentials
Neurons communicate using electrical impulses called action potentials.
The resting membrane potential is typically -70 mV.
Depolarization is caused by the rapid influx of sodium ions (Na+).
Repolarization is driven by potassium ion (K+) efflux.
  `.trim();

  const mockQuestionsPayload: GeneratedQuestionDraft[] = [
    {
      type: 'multiple_choice',
      prompt: 'What ion is primarily responsible for the rapid depolarization phase of an action potential?',
      payload: {
        type: 'multiple_choice',
        choices: ['Potassium (K+)', 'Sodium (Na+)', 'Calcium (Ca2+)', 'Chloride (Cl-)'],
        correctIndex: 1,
      },
      difficulty: 'easy',
      points: 1,
      tags: ['action potentials', 'neurophysiology'],
      explanation: 'Sodium (Na+) influx rapidly depolarizes the neuron membrane.',
    },
    {
      type: 'true_false',
      prompt: 'The resting membrane potential of a typical neuron is around -70 mV.',
      payload: {
        type: 'true_false',
        correctAnswer: true,
      },
      difficulty: 'easy',
      points: 1,
      explanation: 'The resting potential is maintained around -70 mV.',
    },
  ];

  /**
   * Stands in for `AiGroundingResolver`. `markdown: undefined` models a material whose document
   * resolves to nothing, which is the case synthesis must refuse rather than prompt on empty text.
   */
  function stubResolver(markdown: string | undefined): AiGroundingResolver {
    return {
      resolve: async () => ({
        mode: 'whole' as const,
        materialId: 'mat-bio-1',
        ...(markdown
          ? {
              documentContext: {
                id: 'document-mat-bio-1',
                title: 'Biology 101',
                markdown,
              },
            }
          : {}),
        documentCharacters: markdown?.length ?? 0,
      }),
    } as unknown as AiGroundingResolver;
  }

  /** Records what the adapter was actually asked for, then delegates to the real mock. */
  function recordRequests(mockAi: MockAiAdapter): AiGenerationRequest[] {
    const seen: AiGenerationRequest[] = [];
    const original = mockAi.generateStructured.bind(mockAi);
    mockAi.generateStructured = (request, validator) => {
      seen.push(request);
      return original(request, validator);
    };
    return seen;
  }

  it('generates structured questions from the resolved material document and keeps the model topic tags', async () => {
    const mockAi = new MockAiAdapter({
      structuredResponse: mockQuestionsPayload,
    });

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    const batch = await useCase.execute({
      materialId: 'mat-bio-1',
      count: 2,
    });

    expect(batch.drafts).toHaveLength(2);
    expect(batch.rejected).toEqual([]);
    expect(batch.drafts[0].prompt).toContain('What ion is primarily responsible');
    // Tags classify subject matter; no provenance marker is stamped on top.
    expect(batch.drafts[0].tags).toEqual(['action potentials', 'neurophysiology']);
    expect(batch.drafts[0].tags).not.toContain('ai-generated');
    expect(batch.drafts[0].payload.type).toBe('multiple_choice');
    expect(batch.drafts[1].payload.type).toBe('true_false');
  });

  it('keeps the valid questions and reports the malformed ones', async () => {
    // The real-world slip this handles: one item typed as `_false` among otherwise good questions.
    const mixedPayload = [
      mockQuestionsPayload[0],
      { type: '_false', prompt: 'Malformed', payload: { correctAnswer: false } },
      mockQuestionsPayload[1],
    ];
    const mockAi = new MockAiAdapter({ structuredResponse: mixedPayload });

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    const batch = await useCase.execute({ materialId: 'mat-bio-1', count: 3 });

    expect(batch.drafts).toHaveLength(2);
    expect(batch.rejected).toEqual([{ index: 1, error: 'Invalid question type: _false' }]);
  });

  it('prompts with the material document, with no document supplied by the caller', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockQuestionsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    await useCase.execute({ materialId: 'mat-bio-1', count: 2 });

    expect(seen).toHaveLength(1);
    expect(seen[0].userPrompt).toContain('sodium ions');
  });

  it('sends schemas only for the allowed types, with the rules against the observed model slips', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockQuestionsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    await useCase.execute({ materialId: 'mat-bio-1', types: ['multiple_choice', 'true_false'] });

    const { systemPrompt } = seen[0];
    // Unused formats give the model more to imitate, lengthen the prompt, and the tail of a long
    // output is where it degenerates — so only the requested ones are sent.
    expect(systemPrompt).toContain('- multiple_choice:');
    expect(systemPrompt).toContain('- true_false:');
    expect(systemPrompt).not.toContain('- identification:');
    expect(systemPrompt).not.toContain('- multiple_select:');
    // Both real slips seen from llama are named in the rules rather than left implicit.
    expect(systemPrompt).toContain('never `_false`');
    expect(systemPrompt).toContain('FIELD COMPLETENESS');
    expect(systemPrompt).toContain('COMPLETE ANSWERS');
    // Tags are asked for as subject classification, and provenance tagging is ruled out explicitly.
    expect(systemPrompt).toContain('TAGS: give every question 2-4 short topic tags');
    expect(systemPrompt).toContain('"tags": ["verb conjugation", "present tense"]');
  });

  it('carries the topic focus in the system prompt, and omits the line when none is given', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockQuestionsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    await useCase.execute({ materialId: 'mat-bio-1', focusTopic: 'action potentials' });

    // Focus is prompt content rather than a request field, so the prompt is the only place it is
    // observable — there is nothing on the wire to assert it against.
    expect(seen[0].systemPrompt).toContain('- Specific Topic Focus: action potentials');
    // It narrows the authoring instruction; it does not change what the request is grounded in.
    expect(seen[0].userPrompt).toContain('sodium ions');

    await useCase.execute({ materialId: 'mat-bio-1' });

    expect(seen[1].systemPrompt).not.toContain('Specific Topic Focus');
  });

  it('forwards the requested model and derives the output budget from it', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockQuestionsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    await useCase.execute({ materialId: 'mat-bio-1', model: 'ukisai-swift-max' });

    expect(seen[0].model).toBe('ukisai-swift-max');
    // The budget is the served model's output reservation, not a constant in the use case.
    expect(seen[0].maxTokens).toBe(
      getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, 'ukisai-swift-max').maxOutputTokens,
    );
  });

  it('leaves the model unset when none is requested, so the Worker resolves its default', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockQuestionsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    await useCase.execute({ materialId: 'mat-bio-1' });

    expect(seen[0].model).toBeUndefined();
  });

  it('refuses to generate when the material resolves to no readable content', async () => {
    const mockAi = new MockAiAdapter({ structuredResponse: mockQuestionsPayload });
    const seen = recordRequests(mockAi);

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(undefined));

    await expect(useCase.execute({ materialId: 'mat-bio-1' })).rejects.toMatchObject({
      code: 'EMPTY_DOCUMENT',
    });
    // Nothing was sent: an empty prompt is never a request worth making.
    expect(seen).toHaveLength(0);
  });

  it('propagates AI generation errors gracefully', async () => {
    const mockAi = new MockAiAdapter({
      shouldFail: true,
      errorMessage: 'Cloudflare Workers AI timeout',
      errorCode: 'TIMEOUT',
    });

    const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));
    await expect(
      useCase.execute({
        materialId: 'mat-bio-1',
      }),
    ).rejects.toThrowError(/Cloudflare Workers AI timeout/);
  });

  /**
   * The card path. There is no separate flashcard generator: a generated card is a
   * `fill_in_blank` question produced by this same use case, and `questionToCards` projects
   * it into one card per blank. These cases pin the property the projection depends on.
   */
  describe('the card path (fill_in_blank)', () => {
    const clozePayload: GeneratedQuestionDraft[] = [
      {
        type: 'fill_in_blank',
        prompt: 'Fill in the blank with the ion whose influx depolarizes the membrane.',
        payload: {
          type: 'fill_in_blank',
          template: 'Depolarization is driven by ___ (Na+) influx.',
          blanks: ['sodium'],
        },
        difficulty: 'easy',
        points: 1,
        tags: ['action potentials'],
      },
    ];

    it('yields a valid typed cloze question whose blanks match its ___ markers', async () => {
      const mockAi = new MockAiAdapter({ structuredResponse: clozePayload });
      const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));

      const batch = await useCase.execute({
        materialId: 'mat-bio-1',
        types: ['fill_in_blank'],
      });

      expect(batch.rejected).toEqual([]);
      expect(batch.drafts).toHaveLength(1);
      const draft = batch.drafts[0];
      // A real typed question — never a renamed {front, back} and never an identification row.
      expect(draft.type).toBe('fill_in_blank');
      expect(draft.payload.type).toBe('fill_in_blank');
      // The parity `questionToCards` needs: the template's marker count IS the blank count,
      // so every card front has exactly one `___` to hide and one real answer behind it.
      const payload = draft.payload as { template: string; blanks: string[] };
      expect((payload.template.match(/___/g) ?? []).length).toBe(payload.blanks.length);
      expect(payload.blanks).toHaveLength(1);
    });

    it('rejects a cloze whose marker and answer counts disagree, keeping its valid siblings', async () => {
      const mockAi = new MockAiAdapter({
        structuredResponse: [
          {
            type: 'fill_in_blank',
            prompt: 'Mismatched',
            payload: { type: 'fill_in_blank', template: 'A ___ and a ___.', blanks: ['one'] },
          },
          ...clozePayload,
        ],
      });
      const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));

      const batch = await useCase.execute({ materialId: 'mat-bio-1', types: ['fill_in_blank'] });

      // Salvage-based, as every generator batch is: the sibling survives, the defect is named.
      expect(batch.drafts).toHaveLength(1);
      expect(batch.rejected).toEqual([
        {
          index: 0,
          error: 'fill_in_blank requires one answer per ___ placeholder (2 in template, 1 supplied)',
        },
      ]);
    });

    it('asks the model for cloze atomicity only when the cloze type is allowed', async () => {
      const mockAi = new MockAiAdapter({ structuredResponse: clozePayload });
      const seen = recordRequests(mockAi);
      const useCase = new GenerateQuestionsUseCase(mockAi, stubResolver(sampleMaterialMarkdown));

      await useCase.execute({ materialId: 'mat-bio-1', types: ['fill_in_blank'] });
      // The card prompt's real strength — one discrete fact per blank — survives the
      // consolidation as a rule on the cloze schema rather than as a second prompt.
      expect(seen[0].systemPrompt).toContain('CLOZE ATOMICITY');

      await useCase.execute({ materialId: 'mat-bio-1', types: ['multiple_choice'] });
      // A rule about a type the request excludes is noise in the prompt, so it is omitted.
      expect(seen[1].systemPrompt).not.toContain('CLOZE ATOMICITY');
    });
  });
});
