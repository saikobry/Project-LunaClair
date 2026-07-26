import type { QuestionType } from '../QuestionType';
import type { QuestionStrategy } from './QuestionStrategy';
import { MultipleChoiceStrategy } from './MultipleChoiceStrategy';
import { MultipleSelectStrategy } from './MultipleSelectStrategy';
import { TrueFalseStrategy } from './TrueFalseStrategy';
import { IdentificationStrategy } from './IdentificationStrategy';
import { FillBlankStrategy } from './FillBlankStrategy';

const strategies: Record<QuestionType, QuestionStrategy> = {
    multiple_choice: new MultipleChoiceStrategy(),
    multiple_select: new MultipleSelectStrategy(),
    true_false: new TrueFalseStrategy(),
    identification: new IdentificationStrategy(),
    fill_in_blank: new FillBlankStrategy(),
};

/** Resolves the grading/validation strategy for a given question type. */
export function resolveStrategy(type: QuestionType): QuestionStrategy {
    return strategies[type];
}
