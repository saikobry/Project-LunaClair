import { useSyncExternalStore, useCallback } from 'react';
import {
  SyncCategoryPreferences,
  syncCategoryPreferences,
  type SyncCategoryPreferencesState,
  type SyncCategoryKey,
  isSyncCategoryEnabled,
  DEFAULT_SYNC_CATEGORY_PREFERENCES,
  SYNC_CATEGORY_STORAGE_KEY,
} from '../../../domain/sync/preferences/SyncCategoryPreferences';

export {
  SyncCategoryPreferences,
  syncCategoryPreferences,
  isSyncCategoryEnabled,
  DEFAULT_SYNC_CATEGORY_PREFERENCES,
  SYNC_CATEGORY_STORAGE_KEY,
};
export type { SyncCategoryPreferencesState, SyncCategoryKey };

/**
 * React hook for consuming and updating selective sync category preferences.
 */
export function useSyncCategoryPreferences(
  service: SyncCategoryPreferences = syncCategoryPreferences
) {
  const preferences = useSyncExternalStore(
    service.subscribe.bind(service),
    service.getPreferences.bind(service),
    service.getPreferences.bind(service)
  );

  const setCategoryEnabled = useCallback(
    (category: SyncCategoryKey, enabled: boolean) => {
      service.setCategoryEnabled(category, enabled);
    },
    [service]
  );

  const toggleCategory = useCallback(
    (category: SyncCategoryKey) => {
      service.toggleCategory(category);
    },
    [service]
  );

  const isCategoryEnabled = useCallback(
    (category: string) => service.isCategoryEnabled(category),
    [service]
  );

  return {
    preferences,
    setCategoryEnabled,
    toggleCategory,
    isCategoryEnabled,
  };
}
