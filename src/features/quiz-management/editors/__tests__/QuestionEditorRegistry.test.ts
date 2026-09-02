import { describe, it, expect } from 'vitest';
import {
    getQuestionEditor,
    createDefaultPayload,
    QUESTION_TYPE_OPTIONS,
} from '../QuestionEditorRegistry';
import { MultipleChoiceEditor } from '../MultipleChoiceEditor';
import { MultipleSelectEditor } from '../MultipleSelectEditor';
import { TrueFalseEditor } from '../TrueFalseEditor';
import { IdentificationEditor } from '../IdentificationEditor';
import { FillBlankEditor } from '../FillBlankEditor';

describe('QuestionEditorRegistry', () => {
    it('returns the correct editor component for each question type', () => {
        expect(getQuestionEditor('multiple_choice')).toBe(MultipleChoiceEditor);
        expect(getQuestionEditor('multiple_select')).toBe(MultipleSelectEditor);
        expect(getQuestionEditor('true_false')).toBe(TrueFalseEditor);
        expect(getQuestionEditor('identification')).toBe(IdentificationEditor);
        expect(getQuestionEditor('fill_in_blank')).toBe(FillBlankEditor);
    });

    it('creates accurate default payload for each question type', () => {
        expect(createDefaultPayload('multiple_choice')).toEqual({
            type: 'multiple_choice',
            choices: ['', ''],
            correctIndex: 0,
        });

        expect(createDefaultPayload('multiple_select')).toEqual({
            type: 'multiple_select',
            choices: ['', ''],
            correctIndices: [],
        });

        expect(createDefaultPayload('true_false')).toEqual({
            type: 'true_false',
            correctAnswer: true,
        });

        expect(createDefaultPayload('identification')).toEqual({
            type: 'identification',
            correctAnswer: '',
            acceptedAlternatives: [],
        });

        expect(createDefaultPayload('fill_in_blank')).toEqual({
            type: 'fill_in_blank',
            template: '',
            blanks: [],
        });
    });

    it('exposes question type authoring options', () => {
        expect(QUESTION_TYPE_OPTIONS).toHaveLength(5);
        expect(QUESTION_TYPE_OPTIONS.map((opt) => opt.value)).toEqual([
            'multiple_choice',
            'multiple_select',
            'true_false',
            'identification',
            'fill_in_blank',
        ]);
    });
});
