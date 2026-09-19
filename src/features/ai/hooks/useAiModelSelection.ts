import { useCallback, useContext, useEffect, useState } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
  type AiModelCatalog,
  type AiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';

export interface AiModelSelection {
  /** Best-known catalog: the fetched one when it succeeded, otherwise the bundled mirror. */
  catalog: AiModelCatalog;
  /** Resolved selection — never an id the catalog does not contain. */
  selectedModel: AiModelDescriptor;
  /** Selects the model for the next request and remembers it on this device. */
  selectModel: (modelId: string) => void;
}

/** A stored preference is a hint, not a contract: it is validated against the catalog on read. */
function readStoredModelId(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEYS.ai.modelId) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStoredModelId(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ai.modelId, modelId);
  } catch {
    // A full or unavailable storage must not deprive the user of the choice they just made.
  }
}

/**
 * Owns which model the next request uses, and the catalog it may choose from.
 *
 * The choice is **per request and device-local**, not a property of a conversation: `AiThread`
 * stores no model, every turn records the model that served it, and a conversation may mix models.
 * That is what keeps the change additive — no Dexie migration, no session pinned to a model that
 * may later be retired.
 *
 * The catalog starts as the bundled mirror, so the picker renders offline and on a first run; the
 * fetched catalog replaces it when the Worker answers. An id absent from the catalog (retired, or
 * stored by an older build) resolves to the catalog default rather than being sent and refused.
 */
export function useAiModelSelection(): AiModelSelection {
  const context = useContext(ApplicationContext);
  const [catalog, setCatalog] = useState<AiModelCatalog>(DEFAULT_AI_MODEL_CATALOG);
  const [preferredModelId, setPreferredModelId] = useState<string | undefined>(() =>
    readStoredModelId(),
  );

  useEffect(() => {
    const getModelCatalog = context?.useCases?.ai?.getModelCatalog;
    if (!getModelCatalog) return;

    let cancelled = false;
    void getModelCatalog
      .execute()
      .then((next) => {
        if (!cancelled) setCatalog(next);
      })
      .catch(() => undefined); // The bundled mirror is already in place; a refresh is best-effort.

    return () => {
      cancelled = true;
    };
  }, [context]);

  const selectModel = useCallback((modelId: string) => {
    setPreferredModelId(modelId);
    writeStoredModelId(modelId);
  }, []);

  // Resolved rather than validated in an effect: an unknown id quietly becomes the default, so no
  // render can offer — or send — a model the catalog does not have.
  const selectedModel = getAiModelDescriptor(catalog, preferredModelId);

  return { catalog, selectedModel, selectModel };
}
