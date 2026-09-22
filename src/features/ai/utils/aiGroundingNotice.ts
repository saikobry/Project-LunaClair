import type { AiGroundingMode } from '../../../domain/ai/models/ai.types';

/**
 * Copy for the line beside the material-context control.
 *
 * Kept out of the component as a pure resolver for the same reason the model picker's notice is
 * (`aiModelPickerNotice.ts`): the wording is the whole point of the line, and each mode has to
 * describe *itself* so the choice is legible without hovering or experimenting.
 *
 * Both lines state the **request fact** — what the next message carries — rather than claiming what
 * the model does with it, matching the per-turn "Material attached" tag. "So answers can draw on your
 * notes" is the intent of attaching, not a guarantee about the reply.
 */
export function resolveGroundingNotice(mode: AiGroundingMode): string {
  return mode === 'whole'
    ? "This material's text is attached to each new message, so answers can draw on your notes."
    : 'New messages are sent without the material, so answers come from general knowledge.';
}
