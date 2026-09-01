import { describe, expect, it } from 'vitest';
import { AiContextBuilder } from '../AiContextBuilder';

describe('AiContextBuilder', () => {
    describe('buildDocumentContext', () => {
        it('constructs document context with default title if omitted', () => {
            const result = AiContextBuilder.buildDocumentContext({
                id: 'doc-1',
                markdown: '# Cell Theory',
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('doc-1');
            expect(result?.title).toBe('Untitled Study Material');
            expect(result?.markdown).toBe('# Cell Theory');
        });

        it('returns undefined if id or markdown is missing', () => {
            expect(AiContextBuilder.buildDocumentContext(undefined)).toBeUndefined();
            expect(AiContextBuilder.buildDocumentContext({ id: 'doc-1' })).toBeUndefined();
            expect(AiContextBuilder.buildDocumentContext({ markdown: 'text' })).toBeUndefined();
        });

        it('truncates markdown exceeding maxCharacters with omission notice', () => {
            const longMarkdown = 'a'.repeat(200);
            const result = AiContextBuilder.buildDocumentContext({
                id: 'doc-1',
                markdown: longMarkdown,
                maxCharacters: 50,
            });

            expect(result?.markdown).toContain('a'.repeat(50));
            expect(result?.markdown).toContain('[... Remaining content omitted for brevity ...]');
        });
    });

    describe('buildSelectionContext', () => {
        it('constructs trimmed selection context', () => {
            const result = AiContextBuilder.buildSelectionContext({
                text: '   selected quote   ',
                surroundingHeading: '  Overview  ',
                source: ' reader ',
            });

            expect(result).toEqual({
                text: 'selected quote',
                surroundingHeading: 'Overview',
                source: 'reader',
            });
        });

        it('returns undefined if text is empty or blank', () => {
            expect(AiContextBuilder.buildSelectionContext(undefined)).toBeUndefined();
            expect(AiContextBuilder.buildSelectionContext({ text: '' })).toBeUndefined();
            expect(AiContextBuilder.buildSelectionContext({ text: '   ' })).toBeUndefined();
        });

        it('truncates selection exceeding maxCharacters', () => {
            const longText = 'x'.repeat(100);
            const result = AiContextBuilder.buildSelectionContext({
                text: longText,
                maxCharacters: 30,
            });

            expect(result?.text).toBe(`${'x'.repeat(30)}...`);
        });
    });
});
