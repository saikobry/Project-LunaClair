import { describe, it, expect } from 'vitest';
import { CleanupImportWithAiUseCase } from '../CleanupImportWithAiUseCase';
import type { AiService } from '../../../../domain/ai/AiService';
import type { AiStreamEvent } from '../../../../domain/ai/ai.types';

describe('CleanupImportWithAiUseCase', () => {
    it('streams cleaned markdown and returns both original and cleaned versions', async () => {
        const mockAiService: AiService = {
            async *streamChat(): AsyncIterable<AiStreamEvent> {
                yield { type: 'token', text: '```markdown\n# Cleaned Heading\n\n- Point A\n- Point B\n```' };
            },
            async generateStructured(): Promise<any> {
                throw new Error('Not used');
            },
        };

        const useCase = new CleanupImportWithAiUseCase(mockAiService);
        const result = await useCase.execute('dirty text', 'My Doc');

        expect(result.original).toBe('dirty text');
        expect(result.cleaned).toBe('# Cleaned Heading\n\n- Point A\n- Point B');
    });
});
