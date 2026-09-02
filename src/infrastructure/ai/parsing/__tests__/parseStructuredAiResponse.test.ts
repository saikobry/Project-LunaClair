import { describe, it, expect } from 'vitest';
import { parseStructuredAiResponse } from '../parseStructuredAiResponse';
import { AiGenerationError, type AiStructuredOutputValidator } from '../../../../domain/ai/models/ai.types';

describe('parseStructuredAiResponse', () => {
  interface SampleItem {
    id: number;
    title: string;
  }

  const sampleValidator: AiStructuredOutputValidator<SampleItem[]> = (data: unknown) => {
    if (!Array.isArray(data)) {
      return { success: false, error: 'Expected array' };
    }
    for (const item of data) {
      if (!item || typeof item !== 'object' || typeof (item as any).title !== 'string') {
        return { success: false, error: 'Invalid item shape' };
      }
    }
    return { success: true, data: data as SampleItem[] };
  };

  it('parses direct clean JSON array successfully', () => {
    const raw = '[{"id": 1, "title": "Mitosis"}, {"id": 2, "title": "Meiosis"}]';
    const result = parseStructuredAiResponse(raw, sampleValidator);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Mitosis');
  });

  it('extracts JSON cleanly from markdown code fences', () => {
    const raw = '```json\n[{"id": 1, "title": "DNA Replication"}]\n```';
    const result = parseStructuredAiResponse(raw, sampleValidator);

    expect(result).toEqual([{ id: 1, title: 'DNA Replication' }]);
  });

  it('cleans leading and trailing prose around JSON structure', () => {
    const raw = `
Here are the generated items:
[
  {"id": 10, "title": "Cell Membrane"}
]
I hope this was helpful!
    `;
    const result = parseStructuredAiResponse(raw, sampleValidator);

    expect(result).toEqual([{ id: 10, title: 'Cell Membrane' }]);
  });

  it('conservatively repairs illegal trailing commas in arrays and objects', () => {
    const raw = `
[
  {"id": 1, "title": "Glycolysis", },
  {"id": 2, "title": "Krebs Cycle", },
]
    `;
    const result = parseStructuredAiResponse(raw, sampleValidator);

    expect(result).toHaveLength(2);
    expect(result[1].title).toBe('Krebs Cycle');
  });

  it('repairs missing values before braces or commas', () => {
    const raw = `
[
  {"id": 1, "title": "Glycolysis"},
  {"id": 2, "title": "Krebs Cycle", "correctIndex": }
]
    `;
    const result = parseStructuredAiResponse(raw, sampleValidator);

    expect(result).toHaveLength(2);
    expect(result[1].title).toBe('Krebs Cycle');
  });

  it('salvages complete items from a truncated array stream', () => {
    const truncatedStream = `
[
  {"id": 1, "title": "Mitosis"},
  {"id": 2, "title": "Meiosis"},
  {"id": 3, "title": "Cytoki
    `;
    const result = parseStructuredAiResponse(truncatedStream, sampleValidator);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Mitosis');
    expect(result[1].title).toBe('Meiosis');
  });

  it('throws AiGenerationError on empty input', () => {
    expect(() => parseStructuredAiResponse('', sampleValidator)).toThrowError(
      AiGenerationError,
    );
  });

  it('throws AiGenerationError with code INVALID_STRUCTURED_OUTPUT on schema validation failure', () => {
    const raw = '[{"id": 1, "wrongField": 123}]';
    try {
      parseStructuredAiResponse(raw, sampleValidator);
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AiGenerationError);
      expect(err.code).toBe('INVALID_STRUCTURED_OUTPUT');
    }
  });

  it('throws AiGenerationError on hopelessly malformed JSON', () => {
    const raw = '{"incomplete json: [';
    expect(() => parseStructuredAiResponse(raw, sampleValidator)).toThrowError(
      AiGenerationError,
    );
  });
});
