import * as stylex from '@stylexjs/stylex';
import { X } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';
import { Input } from '../../../shared/ui/Input/Input';
import { CorrectAnswerIndicator } from '../components/CorrectAnswerIndicator';
import { styles } from './choiceList.stylex';

export interface ChoiceListRowProps {
    /** 0-based row index — drives accessible labels and placeholders. */
    index: number;
    choice: string;
    /** Whether this row is currently marked correct. */
    isSelected: boolean;
    /** Indicator shape: `circle` (single) or `square` (multi). */
    shape: 'circle' | 'square';
    onToggle: () => void;
    onChange: (value: string) => void;
    onRemove: () => void;
    /** Min-2 guard result — computed by the owning wrapper, not the row. */
    isRemoveDisabled: boolean;
}

/**
 * Shared presentational row for the choice-list editors: correct-answer
 * indicator, choice input, and remove button. Knows nothing about selection
 * models — `MultipleChoiceEditor` (scalar `correctIndex`) and
 * `MultipleSelectEditor` (`correctIndices: number[]`) stay separate thin
 * wrappers that own their selection logic, index management, and min-2 guard,
 * and render a list of these rows.
 */
export function ChoiceListRow({
    index,
    choice,
    isSelected,
    shape,
    onToggle,
    onChange,
    onRemove,
    isRemoveDisabled,
}: ChoiceListRowProps) {
    const rowNumber = index + 1;
    return (
        <div
            {...stylex.props(styles.choiceRow, isSelected && styles.choiceRowActive)}
        >
            <CorrectAnswerIndicator
                isSelected={isSelected}
                onToggle={onToggle}
                ariaLabel={`Mark choice ${rowNumber} as correct`}
                shape={shape}
            />
            <div {...stylex.props(styles.choiceInput)}>
                <Input
                    label={`Choice ${rowNumber}`}
                    labelHidden
                    value={choice}
                    onChange={onChange}
                    placeholder={`Choice ${rowNumber}`}
                />
            </div>
            <Button
                label={`Remove choice ${rowNumber}`}
                variant="ghost"
                icon={<X size={14} />}
                isIconOnly
                isDisabled={isRemoveDisabled}
                onClick={onRemove}
            />
        </div>
    );
}
