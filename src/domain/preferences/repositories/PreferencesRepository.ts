import type { AiGroundingMode, AiSelectionThreadMode } from '../../ai/models/ai.types';

/**
 * Domain port for locally-stored user preferences.
 *
 * Deliberately typed rather than a generic `get(key)` / `set(key, value)` pair. A generic contract
 * would expose stringly-typed storage to every caller and make accidental cross-feature keys easy;
 * the namespaced key is an adapter detail (`DexiePreferencesRepository` owns it). Each future
 * preference adds a method pair instead of reusing a generic call — that is the point.
 *
 * Preferences are device-local: they live in the same Dexie database as library state, are
 * deliberately not part of the sync entity model, and are excluded from `.lcpack` package
 * import/export.
 */
export interface PreferencesRepository {
  /**
   * The grounding mode a newly created material-scoped conversation should start with.
   *
   * A stored value is a hint, not a contract: an unrecognised, malformed, or missing value falls
   * back to `'whole'`, which is how every conversation behaved before this preference existed.
   */
  getAiGroundingDefault(): Promise<AiGroundingMode>;

  /** Persists the grounding mode that new material-scoped conversations should start with. */
  setAiGroundingDefault(mode: AiGroundingMode): Promise<void>;

  /**
   * Where reader selection actions send their turn: the newest conversation or
   * a distinct new one.
   *
   * A stored value is a hint, not a contract: an unrecognised, malformed, or
   * missing value falls back to `'latest'`, which is how every selection
   * behaved before this preference existed.
   */
  getAiSelectionThreadMode(): Promise<AiSelectionThreadMode>;

  /** Persists where reader selection actions should send their turn. */
  setAiSelectionThreadMode(mode: AiSelectionThreadMode): Promise<void>;
}
