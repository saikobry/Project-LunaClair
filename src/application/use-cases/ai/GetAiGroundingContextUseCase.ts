import type { AiGroundingMode } from '../../../domain/ai/models/ai.types';
import type {
  AiGroundingTarget,
  ResolveAiGroundingOptions,
} from './AiGroundingResolver';
import { AiGroundingResolver } from './AiGroundingResolver';

export interface AiGroundingContextSummary {
  /** The grounding mode the *next* request would use. */
  mode: AiGroundingMode;
  /**
   * Characters the next request's document context would contribute — counted over the serialized
   * context, truncation marker included, so it matches the payload the send path builds.
   */
  documentCharacters: number;
}

/**
 * The context meter's read path.
 *
 * Deliberately returns a count and a mode, **never markdown**: the feature layer needs a number for
 * the meter and the send guard, and has no business holding material text. Both numbers come from the
 * same `AiGroundingResolver` the send path uses, so the meter cannot describe a different document
 * than the one that will be attached.
 *
 * The meter is still an *estimate of the next request*: the two consumers resolve at different times
 * against different database snapshots. An exception here is not zero — a caller must render an
 * indeterminate state, because zero reads as "ungrounded" while the send would actually fail.
 */
export class GetAiGroundingContextUseCase {
  private readonly resolver: AiGroundingResolver;

  constructor(resolver: AiGroundingResolver) {
    this.resolver = resolver;
  }

  /**
   * Accepts a persisted thread, or a draft's `{ materialId, grounding }` for a conversation that has
   * not been created yet — the common case when the composer is open on a new chat.
   */
  async execute(
    target: AiGroundingTarget,
    options: ResolveAiGroundingOptions = {},
  ): Promise<AiGroundingContextSummary> {
    const snapshot = await this.resolver.resolve(target, options);
    return { mode: snapshot.mode, documentCharacters: snapshot.documentCharacters };
  }
}
