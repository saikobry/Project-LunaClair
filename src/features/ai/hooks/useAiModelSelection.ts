import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';
import {
  isAiCatalogDisabled,
  resolveAiModelSelection,
  type AiModelCatalog,
  type AiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';
import { useAiModelCatalog } from './queries/useAiModelCatalog';

export interface AiModelSelection {
  /** Best-known catalog: the served one when a fetch succeeded, otherwise the bundled mirror. */
  catalog: AiModelCatalog;
  /**
   * Resolved selection, or `null` when there is nothing legitimate to send on.
   *
   * `null` covers both "the assistant is switched off" (`availability: 'disabled'`) and "no model is
   * selected because there is no default to inherit" — a single-model catalog with
   * `defaultModelId: null` demands an explicit choice rather than a silent one. The drawers block
   * sending on it; nothing is ever substituted.
   */
  selectedModel: AiModelDescriptor | null;
  /** `true` when the deployment has switched the assistant off entirely. */
  isAiDisabled: boolean;
  /** Selects the model for the next request and remembers it on this device. */
  selectModel: (modelId: string) => void;
  /**
   * Re-reads the catalog after the server refused a model.
   *
   * A `MODEL_UNAVAILABLE` refusal means this client's catalog is behind the server's — a model was
   * just disabled or retired — so the picker is refreshed rather than left offering a choice that
   * has stopped working.
   */
  refreshCatalog: () => void;
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
 * Owns which model the next request uses, on top of the shared catalog query.
 *
 * The choice is **per request and device-local**, not a property of a conversation: `AiThread`
 * stores no model, every turn records the model that served it, and a conversation may mix models.
 * That is what keeps the change additive — no Dexie migration, no session pinned to a model that
 * may later be retired.
 *
 * The preference is stored as an id only; it is **resolved through the catalog on every read**, so a
 * retired or unknown id quietly becomes the catalog default instead of being sent and refused. The
 * catalog itself is not this hook's to own (see `useAiModelCatalog`), so a second consumer shares
 * one entry rather than fetching a second copy.
 */
export function useAiModelSelection(): AiModelSelection {
  const { catalog, refreshCatalog } = useAiModelCatalog();
  const [preferredModelId, setPreferredModelId] = useState<string | undefined>(() =>
    readStoredModelId(),
  );

  const selectModel = useCallback((modelId: string) => {
    setPreferredModelId(modelId);
    writeStoredModelId(modelId);
  }, []);

  // Resolved rather than validated in an effect: an unknown id falls back to the catalog's default,
  // and a catalog with no default to fall back to resolves to nothing at all — so no render can
  // offer, or send, a model the catalog does not have.
  const selectedModel = resolveAiModelSelection(catalog, preferredModelId);

  return {
    catalog,
    selectedModel,
    isAiDisabled: isAiCatalogDisabled(catalog),
    selectModel,
    refreshCatalog,
  };
}
