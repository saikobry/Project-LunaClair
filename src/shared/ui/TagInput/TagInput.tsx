import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Input } from '../Input/Input';
import { Token } from '../Token/Token';

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
    /** Splits raw input text into individual tokens. @default comma-split + trim */
    splitInput?: (text: string) => string[];
    /** Merges incoming tokens into an existing tag list (dedup). @default case-insensitive dedup */
    mergeTags?: (existing: string[], incoming: string[]) => string[];
    /** Derives a stable dedup/comparison key from a tag. @default lowercase trim */
    tagKey?: (tag: string) => string;
    /** Normalizes a tag list (clean, dedup). @default trim + strip '#' + case-insensitive dedup */
    normalizeTags?: (tags: string[]) => string[];
}

/** Default: splits on commas, trims, drops empties. */
function defaultSplitInput(text: string): string[] {
    return text.split(',').map((t) => t.trim()).filter(Boolean);
}

/** Default: lowercase + trim. */
function defaultTagKey(tag: string): string {
    return tag.trim().toLowerCase();
}

/** Default: trims, strips leading '#', deduplicates case-insensitively preserving first casing. */
function defaultNormalizeTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tags) {
        const cleaned = raw.trim().replace(/^#/, '');
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(cleaned);
    }
    return out;
}

/** Default: concat + normalize (dedup). */
function defaultMergeTags(existing: string[], incoming: string[]): string[] {
    return defaultNormalizeTags([...existing, ...incoming]);
}

/**
 * Tag/chip input — the standard tag-entry pattern: type a tag and press Enter,
 * or type/paste comma-separated lists (bulk entry). Each tag renders as a
 * removable `#tag` token; tokens are normalized through the provided `mergeTags`
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
    splitInput = defaultSplitInput,
    mergeTags: mergeTagsFn = defaultMergeTags,
    tagKey: tagKeyFn = defaultTagKey,
    normalizeTags: normalizeTagsFn = defaultNormalizeTags,
}: TagInputProps) {
    const [value, setValue] = useState('');

    const commitTokens = (tokens: string[]) => {
        if (tokens.length === 0) return;
        onChange(mergeTagsFn(tags, tokens));
        setValue('');
    };

    const commitCurrent = () => commitTokens(splitInput(value));

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
        onChange(tags.filter((t) => tagKeyFn(t) !== tagKeyFn(tag)));
    };

    // Render the normalized list so a legacy (pre-migration) duplicate tag
    // list can never produce colliding React keys — `tagKey` is unique on it.
    const visibleTags = normalizeTagsFn(tags) ?? [];

    return (
        <div {...stylex.props(styles.fieldGroup)} onBlur={commitCurrent}>
            {!labelHidden && <span {...stylex.props(styles.fieldLabel)}>{label}</span>}
            {visibleTags.length > 0 && (
                <div {...stylex.props(styles.tagsRow)}>
                    {visibleTags.map((tag) => (
                        <Token
                            key={tagKeyFn(tag)}
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
