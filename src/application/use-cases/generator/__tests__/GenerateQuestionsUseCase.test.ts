import { describe, it, expect } from 'vitest';
import { GenerateQuestionsUseCase } from '../GenerateQuestionsUseCase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
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

  it('generates structured questions from markdown and attaches provenance tags', async () => {
    const mockAi = new MockAiAdapter({
      structuredResponse: mockQuestionsPayload,
    });

    const useCase = new GenerateQuestionsUseCase(mockAi);
    const result = await useCase.execute({
      materialId: 'mat-bio-1',
      documentMarkdown: sampleMaterialMarkdown,
      count: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].prompt).toContain('What ion is primarily responsible');
    expect(result[0].tags).toContain('ai-generated');
    expect(result[0].payload.type).toBe('multiple_choice');
    expect(result[1].payload.type).toBe('true_false');
  });

  it('propagates AI generation errors gracefully', async () => {
    const mockAi = new MockAiAdapter({
      shouldFail: true,
      errorMessage: 'Cloudflare Workers AI timeout',
      errorCode: 'TIMEOUT',
    });

    const useCase = new GenerateQuestionsUseCase(mockAi);
    await expect(
      useCase.execute({
        materialId: 'mat-bio-1',
        documentMarkdown: sampleMaterialMarkdown,
      }),
    ).rejects.toThrowError(/Cloudflare Workers AI timeout/);
  });
});
