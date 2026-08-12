import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Input } from '../Input/Input';
import { Token } from '../Token/Token';
import { mergeTags, normalizeTags, splitTagInput, tagKey } from '../../../domain/quiz/tags';

const styles = stylex.create({
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
    },
    tagsRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
    },
    tagInputForm: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
    },
    tagInputField: {
        flex: 1,
    },
});

export interface TagInputProps {
    /** Field label rendered above the chips/input. @default 'Tags' */
    label?: string;
    /** Whether to visually hide the label. @default false */
    labelHidden?: boolean;
    /** Current tag list. */
    tags: string[];
    /** Emits the merged tag list on add/remove. */
    onChange: (tags: string[]) => void;
    /** Input placeholder. */
    placeholder?: string;
    /** Input size. @default 'md' */
    size?: 'sm' | 'md';
}

/**
 * Tag/chip input — the standard tag-entry pattern: type a tag and press Enter,
 * or type/paste comma-separated lists (bulk entry). Each tag renders as a
 * removable `#tag` token; tokens are normalized through the domain `mergeTags`
 * helper (case-preserving display, case-insensitive dedup) before emitting.
 * Pending input commits on Enter, comma, paste, AND blur (so a modal Save that
 * skips Enter never drops the typed token).
 */
export function TagInput({
    label = 'Tags',
    labelHidden = false,
    tags,
    onChange,
    placeholder = 'Type a tag and press Enter…',
    size = 'md',
}: TagInputProps) {
    const [value, setValue] = useState('');

    const commitTokens = (tokens: string[]) => {
        if (tokens.length === 0) return;
        onChange(mergeTags(tags, tokens));
        setValue('');
    };

    const commitCurrent = () => commitTokens(splitTagInput(value));

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === ',') {
            e.preventDefault();
            commitCurrent();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('text');
        if (!pasted.includes(',')) return; // single token — default paste, finish with Enter
        e.preventDefault();
        const segments = pasted.split(',');
        const complete = segments.slice(0, -1).map((s) => s.trim()).filter(Boolean);
        const trailing = segments[segments.length - 1] ?? '';
        commitTokens(complete);
        setValue(trailing.trim());
    };

    const handleRemove = (tag: string) => {
        onChange(tags.filter((t) => tagKey(t) !== tagKey(tag)));
    };

    // Render the normalized list so a legacy (pre-migration) duplicate tag
    // list can never produce colliding React keys — `tagKey` is unique on it.
    const visibleTags = normalizeTags(tags) ?? [];

    return (
        <div {...stylex.props(styles.fieldGroup)} onBlur={commitCurrent}>
            {!labelHidden && <span {...stylex.props(styles.fieldLabel)}>{label}</span>}
            {visibleTags.length > 0 && (
                <div {...stylex.props(styles.tagsRow)}>
                    {visibleTags.map((tag) => (
                        <Token
                            key={tagKey(tag)}
                            label={`#${tag}`}
                            size="sm"
                            color="purple"
                            onRemove={() => handleRemove(tag)}
                        />
                    ))}
                </div>
            )}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    commitCurrent();
                }}
                {...stylex.props(styles.tagInputForm)}
            >
                <div {...stylex.props(styles.tagInputField)}>
                    <Input
                        label="Add tag"
                        labelHidden
                        value={value}
                        onChange={setValue}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={placeholder}
                        size={size}
                    />
                </div>
            </form>
        </div>
    );
}

TagInput.displayName = 'TagInput';
