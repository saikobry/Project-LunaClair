import { useState, type InputHTMLAttributes } from 'react';

interface UseInlineEditDraftOptions {
  /** Server value the draft seeds from, and re-seeds to when `resetKey` changes. */
  value: string;
  /** Identity of the server value. A change re-seeds the draft; identical values do not. */
  resetKey: string;
  /**
   * Applies the draft. Return `false` to reject it, which restores `value`
   * (used by the title to reject an all-whitespace edit).
   */
  onCommit: (next: string) => boolean | void;
}

/**
 * Inline-editable text field state: a local draft seeded from a server value,
 * committed on blur, with Enter to commit and Escape to revert.
 *
 * The draft is re-seeded during render when `resetKey` changes — a guarded
 * render-phase adjustment, the same documented pattern used by
 * `EditCollectionModal`. It cannot be derived during render because in-progress
 * edits must survive refetches that return identical server values.
 *
 * Extracted from `CollectionHero`'s title and description inputs, which were
 * verbatim copies of each other (and a third copy of the pattern lives in
 * `EditCollectionModal`).
 */
export function useInlineEditDraft({ value, resetKey, onCommit }: UseInlineEditDraftOptions) {
  const [draft, setDraft] = useState(value);
  const [prevKey, setPrevKey] = useState(resetKey);

  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setDraft(value);
  }

  const reset = () => setDraft(value);

  const commit = () => {
    if (onCommit(draft) === false) reset();
  };

  const inputProps: Pick<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'onBlur' | 'onKeyDown'
  > = {
    value: draft,
    onChange: (event) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        // The keydown precedes the blur, so resetting the draft here is what
        // the later `commit` sees — a rejected commit is a no-op.
        reset();
        event.currentTarget.blur();
      }
    },
  };

  return { draft, setDraft, commit, reset, inputProps };
}
