import type { SyncCategory } from '../policy/SyncPolicy';

export interface SyncCategoryPreferencesState {
  annotations: boolean;
  flashcards: boolean;
  quizHistory: boolean;
  customMaterials: boolean;
}

export type SyncCategoryKey = keyof SyncCategoryPreferencesState;

export const DEFAULT_SYNC_CATEGORY_PREFERENCES: Readonly<SyncCategoryPreferencesState> = Object.freeze({
  annotations: true,
  flashcards: true,
  quizHistory: true,
  customMaterials: true,
});

export const SYNC_CATEGORY_STORAGE_KEY = 'lunaclair.sync.category_preferences';

/**
 * Manages device-local category preferences for selective synchronization.
 */
export class SyncCategoryPreferences {
  private state: SyncCategoryPreferencesState;
  private readonly storage?: Storage;
  private readonly listeners = new Set<(state: SyncCategoryPreferencesState) => void>();

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    this.state = this.load();
  }

  getPreferences(): SyncCategoryPreferencesState {
    return this.state;
  }

  isCategoryEnabled(category: SyncCategory | SyncCategoryKey | string): boolean {
    if (category === 'studyHistory' || category === 'quizHistory') {
      return this.state.quizHistory;
    }
    if (category in this.state) {
      return this.state[category as SyncCategoryKey];
    }
    return true;
  }

  setCategoryEnabled(category: SyncCategoryKey, enabled: boolean): void {
    if (this.state[category] === enabled) return;
    this.state = {
      ...this.state,
      [category]: enabled,
    };
    this.persist();
    this.notify();
  }

  toggleCategory(category: SyncCategoryKey): void {
    this.setCategoryEnabled(category, !this.state[category]);
  }

  async disableCategory(
    category: SyncCategoryKey,
    runBypass?: () => Promise<void>
  ): Promise<void> {
    if (runBypass) {
      await runBypass();
    }
    this.setCategoryEnabled(category, false);
  }

  reset(): void {
    this.state = { ...DEFAULT_SYNC_CATEGORY_PREFERENCES };
    this.persist();
    this.notify();
  }

  subscribe(listener: (state: SyncCategoryPreferencesState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private load(): SyncCategoryPreferencesState {
    if (!this.storage) {
      return { ...DEFAULT_SYNC_CATEGORY_PREFERENCES };
    }
    try {
      const raw = this.storage.getItem(SYNC_CATEGORY_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SYNC_CATEGORY_PREFERENCES };
      const parsed = JSON.parse(raw) as Partial<SyncCategoryPreferencesState>;
      return {
        annotations: typeof parsed.annotations === 'boolean' ? parsed.annotations : true,
        flashcards: typeof parsed.flashcards === 'boolean' ? parsed.flashcards : true,
        quizHistory: typeof parsed.quizHistory === 'boolean' ? parsed.quizHistory : true,
        customMaterials: typeof parsed.customMaterials === 'boolean' ? parsed.customMaterials : true,
      };
    } catch {
      return { ...DEFAULT_SYNC_CATEGORY_PREFERENCES };
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SYNC_CATEGORY_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage errors are non-fatal for memory state
    }
  }

  private notify(): void {
    const snapshot = this.state;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in sync category preferences subscriber', err);
      }
    }
  }
}

export const syncCategoryPreferences = new SyncCategoryPreferences();

export function isSyncCategoryEnabled(category: SyncCategory | SyncCategoryKey | string): boolean {
  return syncCategoryPreferences.isCategoryEnabled(category);
}
