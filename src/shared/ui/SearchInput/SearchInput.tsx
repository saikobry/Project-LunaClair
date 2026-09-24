import { Search } from 'lucide-react';
import { Input, type InputProps } from '../Input/Input';

export type SearchInputProps = Omit<
  InputProps,
  'startIcon' | 'type' | 'labelHidden'
> & {
  /** Search icon size in px. @default 15 */
  iconSize?: number;
};

/**
 * LunaClair SearchInput — the app's single search field.
 *
 * A *pure* thin composition over `<Input>` (not a new Astryx adapter): `Input`
 * already forwards `startIcon`, `clearable`, `size`, and `aria-label`. It exists
 * only to standardize what six call sites had hand-rolled and drifted on — the
 * lucide `Search` start icon, its size (15), and its `--color-text-secondary`
 * tint (three sites were passing that as an inline `style`, which is invalid for
 * a role token only in the sense that it duplicated the primitive's concern).
 *
 * Deliberately NOT owned here:
 * - **Debouncing.** `onChange` fires on every keystroke, exactly like `Input`.
 *   Damping is context-specific (the quiz question bank wants a longer window
 *   than a small collection's quiz list), so each caller keeps its own
 *   `useDebounce`. A debouncing primitive would hold hidden internal state
 *   (displayed value vs emitted value) and could stack with a caller's debounce.
 * - **A new size vocabulary.** `Input`'s own `'sm' | 'md' | 'lg'` is forwarded
 *   transparently so no orphan abstraction is created.
 *
 * The label is always visually hidden: every search field is named by its
 * placeholder, but the label still supplies the accessible name.
 */
export function SearchInput({
  iconSize = 15,
  clearable = true,
  size = 'md',
  ...props
}: SearchInputProps) {
  return (
    <Input
      {...props}
      labelHidden
      clearable={clearable}
      size={size}
      startIcon={
        <Search size={iconSize} style={{ color: 'var(--color-text-secondary)' }} />
      }
    />
  );
}

SearchInput.displayName = 'SearchInput';
