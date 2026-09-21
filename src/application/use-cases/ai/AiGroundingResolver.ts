import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type { LibraryRepository } from '../../../domain/library/repositories/LibraryRepository';
import type { DocumentRepository } from '../../../domain/reader/repositories/DocumentRepository';
import type { AiDocumentContext, AiGroundingMode } from '../../../domain/ai/models/ai.types';
import { AiContextBuilder } from '../../../domain/ai/context/AiContextBuilder';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';

/**
 * Grounding target for a persisted conversation. The mode is read off the thread, so no caller has
 * to remember it — which is what makes a retry grounded by construction.
 */
export interface PersistedGroundingTarget {
  threadId: string;
}

/**
 * Grounding target for a draft session that has no row yet. The caller owns the material and the
 * draft's own mode, because there is no thread to read them from.
 */
export interface DraftGroundingTarget {
  materialId?: string;
  grounding: AiGroundingMode;
}

export type AiGroundingTarget = PersistedGroundingTarget | DraftGroundingTarget;

export interface AiGroundingSnapshot {
  /** The mode actually in force after resolution. */
  mode: AiGroundingMode;
  /** The material in scope, when there is one. */
  materialId?: string;
  /** Present only when `mode === 'whole'` and the material resolved to a document. */
  documentContext?: AiDocumentContext;
  /**
   * Length of the string that will actually be sent: the *serialized* `buildDocumentContext` output,
   * including its `[... Remaining content omitted for brevity ...]` marker.
   *
   * Deliberately not `min(rawLength, cap)`, which undercounts every truncated document — the meter
   * would then be wrong precisely when the document is large enough for the number to matter.
   */
  documentCharacters: number;
}

/**
 * Raised when a thread says it is grounded but the material or its document cannot be read.
 *
 * Failing loudly is the point: silently sending an ungrounded request would be the no-silent-fallback
 * principle's exact violation, and the user would get a general-knowledge answer that looks grounded.
 */
export class AiGroundingUnavailableError extends Error {
  readonly code = 'GROUNDING_UNAVAILABLE';

  constructor(message = 'The study material for this conversation is unavailable.') {
    super(message);
    this.name = 'AiGroundingUnavailableError';
  }
}

/**
 * Raised when a send targets a conversation that no longer exists.
 *
 * Distinct from `AiGroundingUnavailableError` on purpose: "this row is gone" is not "this material
 * is unreadable", and conflating them would let a deleted thread resolve to `'none'` and have turns
 * written against a parent that no longer exists. It is also not the meter's unknown state — the
 * meter may proceed unestimated, but a request must not proceed against an invalid conversation.
 */
export class AiThreadUnavailableError extends Error {
  readonly code = 'THREAD_NOT_FOUND';

  constructor(message = 'This conversation no longer exists.') {
    super(message);
    this.name = 'AiThreadUnavailableError';
  }
}

export interface ResolveAiGroundingOptions {
  /** App-facing model id; its `maxDocumentContextChars` is the cap actually applied. */
  model?: string;
  signal?: AbortSignal;
}

/**
 * The single resolution algorithm behind both the request payload and the context meter.
 *
 * Thread → material → document → model-capped context. Callers differ only in what they consume:
 * `SendChatMessageUseCase` uses `documentContext.markdown`, `GetAiGroundingContextUseCase` reads
 * `documentCharacters` and never sees material text. Sharing the algorithm is what keeps the meter
 * describing the same document the send path will attach.
 *
 * It is *one algorithm and one source of truth*, not an atomic guarantee: the two consumers resolve
 * at different times against different database snapshots, so a writer edit, a removal, a grounding
 * toggle, or a model change landing between them can still differ. The meter is therefore an estimate
 * of the next request, not a report on one in flight.
 */
export class AiGroundingResolver {
  private readonly chatRepo: AiChatRepository;
  private readonly libraryRepo: LibraryRepository;
  private readonly documentRepo: DocumentRepository;

  constructor(
    chatRepo: AiChatRepository,
    libraryRepo: LibraryRepository,
    documentRepo: DocumentRepository,
  ) {
    this.chatRepo = chatRepo;
    this.libraryRepo = libraryRepo;
    this.documentRepo = documentRepo;
  }

  async resolve(
    target: AiGroundingTarget,
    options: ResolveAiGroundingOptions = {},
  ): Promise<AiGroundingSnapshot> {
    const { mode, materialId } = await this.resolveTarget(target);

    if (mode === 'none' || materialId === undefined) {
      return { mode: 'none', documentCharacters: 0 };
    }

    const material = await this.libraryRepo.getMaterialById(materialId, options.signal);
    if (!material) {
      throw new AiGroundingUnavailableError();
    }

    const document = await this.documentRepo.getDocumentByMaterial(material, options.signal);

    // The cap is a fact about the served model, so a large-window model is not fed the default
    // model's document budget.
    const documentContext = AiContextBuilder.buildDocumentContext({
      id: material.id,
      title: material.title,
      markdown: document.content,
      maxCharacters: getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, options.model)
        .maxDocumentContextChars,
    });

    return {
      mode: 'whole',
      materialId,
      documentContext,
      documentCharacters: documentContext?.markdown.length ?? 0,
    };
  }

  /**
   * Resolves only the mode and scope, without touching the document.
   *
   * A global thread is always `'none'` regardless of the stored value: the repository normalizes
   * corrupt rows on read, and a write must never create one, so this is the invariant restated at
   * the point of use rather than trusted from storage.
   */
  private async resolveTarget(
    target: AiGroundingTarget,
  ): Promise<{ mode: AiGroundingMode; materialId?: string }> {
    if ('threadId' in target) {
      const thread = await this.chatRepo.getThread(target.threadId);
      // A missing thread is a failure, not an ungrounded conversation: returning `'none'` here would
      // let a request proceed and persist turns under a parent that no longer exists.
      if (!thread) throw new AiThreadUnavailableError();
      return { mode: thread.materialId === undefined ? 'none' : thread.grounding, materialId: thread.materialId };
    }

    if (target.materialId === undefined) return { mode: 'none' };
    return { mode: target.grounding === 'whole' ? 'whole' : 'none', materialId: target.materialId };
  }
}
