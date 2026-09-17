import { useMemo } from 'react';
import { useLibrary } from '../../materials/hooks/queries/useLibrary';

/**
 * Exact clone identity for every imported material: `originShareId` → local
 * material id.
 *
 * One lookup answers both halves of the question — "is this share already in my
 * library?" and "which local material did it become?" — so membership and
 * target can never disagree. The local id is not derivable from the share id,
 * which is why the map exists at all.
 *
 * First match wins: a share cloned twice keeps one stable target (the materials
 * list arrives in a stable order from `useLibrary`), and either copy is a valid
 * destination.
 *
 * Lives in `discovery` because exact clone identity is this feature's contract
 * (`originShareId` is stamped by `ClonePublishedShareUseCase` and by the share
 * landing surface). Both consumers — the Explore aggregator and the share
 * landing screen — read membership from here rather than re-deriving it.
 */
export function useLocalOriginMaterials(): ReadonlyMap<string, string> {
  const { materials } = useLibrary();

  return useMemo(() => {
    const byOrigin = new Map<string, string>();
    for (const material of materials) {
      if (material.originShareId && !byOrigin.has(material.originShareId)) {
        byOrigin.set(material.originShareId, material.id);
      }
    }
    return byOrigin;
  }, [materials]);
}
