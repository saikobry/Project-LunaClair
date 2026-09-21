import type { AiGroundingMode, AiSelectionThreadMode } from '../../../domain/ai/models/ai.types';
import type { PreferencesRepository } from '../../../domain/preferences/repositories/PreferencesRepository';
import { db, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * The `preferences` row key holding the new-conversation grounding default.
 *
 * Exported only so tests can assert the stored row without re-typing the literal. It stays here,
 * not on the domain port, so no caller outside this adapter can see or invent a key.
 */
export const AI_GROUNDING_DEFAULT_KEY = 'ai.groundingDefault';

/**
 * The `preferences` row key holding the reader-selection thread mode.
 *
 * Exported for the same test-only reason as the grounding key above.
 */
export const AI_SELECTION_THREAD_MODE_KEY = 'ai.selectionThreadMode';

/**
 * Dexie-backed `PreferencesRepository`.
 *
 * The `preferences` store has existed in the schema since an early version and was never written
 * to; this is its first real consumer. It needs **no schema version**: the store is declared as
 * `preferences: 'key'` (schema.ts) and inherited through the schema spreads.
 */
export class DexiePreferencesRepository implements PreferencesRepository {
  private readonly database: LunaClairDatabase;

  constructor(database: LunaClairDatabase = db) {
    this.database = database;
  }

  async getAiGroundingDefault(): Promise<AiGroundingMode> {
    const row = await this.database.preferences.get(AI_GROUNDING_DEFAULT_KEY);
    // Only a recognised mode is honoured; anything else reads as the pre-preference behaviour.
    return row?.value === 'none' ? 'none' : 'whole';
  }

  async setAiGroundingDefault(mode: AiGroundingMode): Promise<void> {
    await this.database.preferences.put({ key: AI_GROUNDING_DEFAULT_KEY, value: mode });
  }

  async getAiSelectionThreadMode(): Promise<AiSelectionThreadMode> {
    const row = await this.database.preferences.get(AI_SELECTION_THREAD_MODE_KEY);
    // Only a recognised mode is honoured; anything else reads as the pre-preference behaviour.
    return row?.value === 'new' ? 'new' : 'latest';
  }

  async setAiSelectionThreadMode(mode: AiSelectionThreadMode): Promise<void> {
    await this.database.preferences.put({ key: AI_SELECTION_THREAD_MODE_KEY, value: mode });
  }
}

/** Singleton instance of DexiePreferencesRepository */
export const dexiePreferencesRepository = new DexiePreferencesRepository();
