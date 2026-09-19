/** Contextual actions the reader can invoke on a text selection. */
export type AiSelectionAction = 'explain' | 'simplify' | 'example';

/** Wraps the excerpt as a Markdown quote so the model can see exactly what was selected. */
function quote(text: string): string {
  return `> "${text}"`;
}

/**
 * Builds the prompt for a reader selection action.
 *
 * These are prompt presets, not tutor modes: they ride the same single assistant mode, and the
 * template is the only thing that distinguishes them.
 */
export function buildSelectionActionPrompt(action: AiSelectionAction, text: string): string {
  switch (action) {
    case 'explain':
      return `Please explain the following excerpt in clear detail:\n\n${quote(text)}`;
    case 'simplify':
      return `Please simplify this concept into plain, intuitive terms that are easy to remember:\n\n${quote(text)}`;
    case 'example':
      return `Please provide a clear, real-world example illustrating this concept:\n\n${quote(text)}`;
  }
}
