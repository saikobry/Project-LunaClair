import { describe, expect, it } from 'vitest';
import { resolveClozeCardFront } from '../clozeCardFront';

describe('resolveClozeCardFront', () => {
    const TEMPLATE = 'The ___ stores DNA in the ___ .';

    describe('a generic or empty prompt contributes nothing', () => {
        it('resolves a generic prompt to the bare template', () => {
            expect(resolveClozeCardFront('Fill in the blank:', TEMPLATE)).toBe(TEMPLATE);
        });

        it('resolves a generic prompt to the bare template whatever its casing and surrounding words', () => {
            expect(resolveClozeCardFront('FILL IN THE BLANK', TEMPLATE)).toBe(TEMPLATE);
            expect(resolveClozeCardFront('Please fill in the blank', TEMPLATE)).toBe(TEMPLATE);
        });

        it('resolves an empty or whitespace-only prompt to the bare template', () => {
            expect(resolveClozeCardFront('', TEMPLATE)).toBe(TEMPLATE);
            expect(resolveClozeCardFront('   \n ', TEMPLATE)).toBe(TEMPLATE);
        });
    });

    describe('a real prompt is prefixed to the template', () => {
        it('joins a distinct, marker-free prompt above the template with a blank line', () => {
            expect(resolveClozeCardFront('Complete the sentence about the nucleus.', TEMPLATE)).toBe(
                'Complete the sentence about the nucleus.\n\nThe ___ stores DNA in the ___ .'
            );
        });

        it('trims the surrounding whitespace of both parts before joining', () => {
            expect(resolveClozeCardFront('  Why is the nucleus important?  ', `  ${TEMPLATE}  `)).toBe(
                'Why is the nucleus important?\n\nThe ___ stores DNA in the ___ .'
            );
        });
    });

    describe('a prompt holding the markers wins outright', () => {
        it('returns the prompt alone when it carries the ___ markers, so the template is never read', () => {
            expect(resolveClozeCardFront('The ___ stores the ___.', 'Ignored by the projection.')).toBe(
                'The ___ stores the ___.'
            );
        });

        it('returns the prompt alone when the prompt and the template are the same text', () => {
            expect(resolveClozeCardFront(TEMPLATE, TEMPLATE)).toBe(TEMPLATE);
        });
    });
});
