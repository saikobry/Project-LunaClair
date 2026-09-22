import { useCallback } from 'react';
import {
  isAiCatalogDisabled,
  resolveAiModelSelection,
  type AiModelCatalog,
  type AiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';
import { useAiModelCatalog } from './queries/useAiModelCatalog';
import { usePreferredModelId } from './queries/usePreferredModelId';

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

/**
 * Owns which model the next request uses, on top of the shared catalog query.
 *
 * The choice is **per request and device-local**, not a property of a conversation: `AiThread`
 * stores no model, every turn records the model that served it, and a conversation may mix models.
 * The preference itself lives in the Dexie-backed `PreferencesRepository` (read through the shared
 * `preferred-model` cache entry); it is stored as an id only and **resolved through the catalog on
 * every read**, so a retired or unknown id quietly becomes the catalog default instead of being
 * sent and refused.
 */
export function useAiModelSelection(): AiModelSelection {
  const { catalog, refreshCatalog } = useAiModelCatalog();
  const { preferredModelId, setPreferredModelId } = usePreferredModelId();

  const selectModel = useCallback(
    (modelId: string) => {
      // A failed write degrades to the catalog default through the unchanged
      // cache entry — the rejection is consumed here so it never surfaces as
      // an unhandled rejection in the drawer or settings.
      setPreferredModelId(modelId).catch(() => undefined);
    },
    [setPreferredModelId],
  );

  // Resolved rather than validated in an effect: an unknown id falls back to the catalog's default,
  // and a catalog with no default to fall back to resolves to nothing at all — so no render can
  // offer, or send, a model the catalog does not have.
  const selectedModel = resolveAiModelSelection(catalog, preferredModelId ?? undefined);

  return {
    catalog,
    selectedModel,
    isAiDisabled: isAiCatalogDisabled(catalog),
    selectModel,
    refreshCatalog,
  };
}
