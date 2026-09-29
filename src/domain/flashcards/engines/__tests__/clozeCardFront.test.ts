import { describe, expect, it } from 'vitest';
import { resolveClozeCardFront } from '../clozeCardFront';
import { questionToCards } from '../questionToCards';
import { buildCardKeyPool } from '../../../analytics/engines/cardKeyPool';
import type { Question } from '../../../quiz/models/Question';

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

    /**
     * A template carrying no text is resolved HERE, at the field's owner, and every caller
     * inherits the reading. This is NOT a tolerance for malformed content: a
     * `fill_in_blank` question whose author has not typed the template yet is a real
     * authoring state, the question is allowed to be in that state, and its front is the
     * prompt — the only text such a row has.
     *
     * The `template` parameter is typed `string`, not `unknown`: it used to be widened
     * and normalised here because the package read tier imported a row carrying no usable
     * template. That tier is gone and every ingress validates, so a non-string is not a
     * state this function is reached in.
     */
    describe('a template that contributes no text', () => {
        it('resolves a blank or whitespace-only template to the prompt', () => {
            expect(resolveClozeCardFront('Complete the sentence about the nucleus.', '')).toBe(
                'Complete the sentence about the nucleus.'
            );
            expect(resolveClozeCardFront('Complete the sentence about the nucleus.', '   ')).toBe(
                'Complete the sentence about the nucleus.'
            );
        });

        it('still resolves to the prompt when the prompt is the generic one, because it is the only text left', () => {
            expect(resolveClozeCardFront('Fill in the blank:', '')).toBe('Fill in the blank:');
        });

        it('leaves the prompt a genuine bug: a non-string prompt still throws rather than degrading', () => {
            // The package validator refuses a non-string prompt, so it is a real defect rather
            // than a tolerated shape. Narrowing the template parameter to `string` must not
            // have widened into swallowing it.
            expect(() => resolveClozeCardFront(42 as unknown as string, TEMPLATE)).toThrow(TypeError);
        });
    });

    describe('through the real caller — a cloze whose template is not written yet', () => {
        const MATERIAL_ID = 'mat-cell';
        const QUESTION_ID = 'q-cloze-unwritten';

        /**
         * The projection must render a card for a question whose template is still empty —
         * dropping it would silently remove the question from the deck, and this is a state
         * the authoring surface produces on its own.
         */
        const clozeWith = (payload: unknown, prompt: string): Question =>
            ({
                id: QUESTION_ID,
                materialId: MATERIAL_ID,
                type: 'fill_in_blank',
                prompt,
                payload,
                difficulty: 'medium',
                points: 1,
                status: 'published',
                version: 1,
                createdAt: '2026-08-27T00:00:00.000Z',
                updatedAt: '2026-08-27T00:00:00.000Z',
            }) as unknown as Question;

        it('recovers the full one-card-per-blank shape when the prompt holds the markers', () => {
            // The best outcome, and the reason the reading is "the prompt is the front" rather
            // than "the empty template": the prompt IS the cloze source, so the row still
            // expands per blank.
            const question = clozeWith(
                { type: 'fill_in_blank', template: '', blanks: ['nucleus'] },
                'The ___ stores DNA.'
            );

            const cards = questionToCards(question);

            expect(cards.map((card) => card.key)).toEqual([`q:${QUESTION_ID}#0`]);
            expect(cards[0].front).toBe('The ___ stores DNA.');
            expect(cards[0].back).toBe('nucleus');
            // The analytics pool is the other consumer of this projection and it
            // resolves a schedule by key, so the key has to be the one it can look up.
            expect([...buildCardKeyPool([question])]).toEqual([`q:${QUESTION_ID}#0`]);
        });

        it('degrades to one usable card when the prompt carries no marker either', () => {
            const question = clozeWith(
                { type: 'fill_in_blank', template: '', blanks: ['nucleus'] },
                'Complete the sentence about the nucleus.'
            );

            const cards = questionToCards(question);

            expect(cards).toHaveLength(1);
            expect(cards[0].kind).toBe('recall');
            expect(cards[0].key).toBe(`q:${QUESTION_ID}`);
            // Usable, not merely non-throwing: both faces carry text, and the key
            // the pool resolves is the one the deck stores review state under.
            expect(cards[0].front).toBe('Complete the sentence about the nucleus.');
            expect(cards[0].back).toBe('nucleus');
            expect([...buildCardKeyPool([question])]).toEqual([`q:${QUESTION_ID}`]);
        });
    });
});
