import { describe, expect, it } from 'vitest';
import { resolveStrategy } from '../QuestionStrategyResolver';
import { MultipleChoiceStrategy } from '../MultipleChoiceStrategy';
import { MultipleSelectStrategy } from '../MultipleSelectStrategy';
import { TrueFalseStrategy } from '../TrueFalseStrategy';
import { IdentificationStrategy } from '../IdentificationStrategy';
import { FillBlankStrategy } from '../FillBlankStrategy';
import type { QuestionType } from '../../models/QuestionType';

describe('QuestionStrategyResolver', () => {
    it('resolves the correct strategy instance for all five question types', () => {
        expect(resolveStrategy('multiple_choice')).toBeInstanceOf(MultipleChoiceStrategy);
        expect(resolveStrategy('multiple_select')).toBeInstanceOf(MultipleSelectStrategy);
        expect(resolveStrategy('true_false')).toBeInstanceOf(TrueFalseStrategy);
        expect(resolveStrategy('identification')).toBeInstanceOf(IdentificationStrategy);
        expect(resolveStrategy('fill_in_blank')).toBeInstanceOf(FillBlankStrategy);
    });

    it('returns undefined or falsy for unrecognized question types', () => {
        expect(resolveStrategy('unsupported_type' as QuestionType)).toBeUndefined();
    });
});
