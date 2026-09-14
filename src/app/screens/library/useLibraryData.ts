import { useMemo } from 'react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Collection } from '../../../domain/collections/models/Collection';
import type { MaterialMembershipFilter } from '../../../features/materials/types/libraryFilter.types';

/**
 * Screen-owned library queries: tag ranking, material filtering, and the
 * collection browser search. Kept out of `LibraryScreen` so the screen stays
 * a composer — each hook holds one decision cluster.
 */

/** Unique tags ranked by material frequency (desc, alphabetical tiebreak). */
export function rankTags(materials: StudyMaterial[]): string[] {
  const counts = new Map<string, number>();
  materials.forEach((m) => {
    m.tags?.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

export function useRankedTags(materials: StudyMaterial[]): string[] {
  return useMemo(() => rankTags(materials), [materials]);
}

/** Search predicate: title, description, or any tag (substring, case-insensitive). */
export function matchesMaterialSearch(material: StudyMaterial, query: string): boolean {
  if (!query) return true;
  return (
    material.title.toLowerCase().includes(query) ||
    Boolean(material.description?.toLowerCase().includes(query)) ||
    Boolean(material.tags?.some((tag) => tag.toLowerCase().includes(query)))
  );
}

/** Membership-lens predicate against the assigned-material set. */
export function matchesMaterialMembership(
  materialId: string,
  membershipFilter: MaterialMembershipFilter,
  assignedIds: ReadonlySet<string>,
): boolean {
  if (membershipFilter === 'all') return true;
  const isFiled = assignedIds.has(materialId);
  return membershipFilter === 'collected' ? isFiled : !isFiled;
}

export interface BaseMaterialFilter {
  searchQuery: string;
  membershipFilter: MaterialMembershipFilter;
  assignedIds: ReadonlySet<string>;
}

/**
 * Materials matching search AND the membership lens, ignoring selected tags.
 * The faceted tag row ranks from this base — deriving tags from the final
 * (tag-filtered) list would hide co-occurring tags as soon as one is picked.
 */
export function useBaseMaterials(
  materials: StudyMaterial[],
  filter: BaseMaterialFilter,
): StudyMaterial[] {
  const { searchQuery, membershipFilter, assignedIds } = filter;
  return useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return materials.filter(
      (m) =>
        matchesMaterialSearch(m, query) &&
        matchesMaterialMembership(m.id, membershipFilter, assignedIds),
    );
  }, [materials, searchQuery, membershipFilter, assignedIds]);
}

/**
 * Faceted tag row: frequency-ranked tags of the search+membership base, with
 * any selected tag pinned even when the base no longer contains it (so an
 * active filter never loses its deselect affordance).
 */
export function useFacetedTags(baseMaterials: StudyMaterial[], selectedTags: string[]): string[] {
  return useMemo(() => {
    const ranked = rankTags(baseMaterials);
    if (selectedTags.length === 0) return ranked;
    const rankedSet = new Set(ranked);
    return [...ranked, ...selectedTags.filter((t) => !rankedSet.has(t))];
  }, [baseMaterials, selectedTags]);
}

/** OR-within tag predicate applied to the search+membership base. */
export function useTagFilteredMaterials(
  baseMaterials: StudyMaterial[],
  selectedTags: string[],
): StudyMaterial[] {
  return useMemo(() => {
    if (selectedTags.length === 0) return baseMaterials;
    return baseMaterials.filter((m) => {
      const materialTags = new Set(m.tags);
      return selectedTags.some((t) => materialTags.has(t));
    });
  }, [baseMaterials, selectedTags]);
}

export interface MaterialFilter {
  searchQuery: string;
  selectedTags: string[];
  membershipFilter: MaterialMembershipFilter;
  assignedIds: ReadonlySet<string>;
}

/** Materials matching search AND tags (any) AND the membership lens. */
export function useFilteredMaterials(materials: StudyMaterial[], filter: MaterialFilter): StudyMaterial[] {
  const { searchQuery, selectedTags, membershipFilter, assignedIds } = filter;
  const base = useBaseMaterials(materials, { searchQuery, membershipFilter, assignedIds });
  return useTagFilteredMaterials(base, selectedTags);
}

/** Collection browser search (title + description). */
export function useVisibleCollections(collections: Collection[], collectionSearch: string): Collection[] {
  return useMemo(() => {
    const query = collectionSearch.trim().toLowerCase();
    if (!query) return collections;
    return collections.filter((c) =>
      `${c.title} ${c.description ?? ''}`.toLowerCase().includes(query),
    );
  }, [collections, collectionSearch]);
}

/** Page subtitle: `N materials · M collections` (hidden while loading). */
export function formatLibraryDescription(
  isLoading: boolean,
  materialCount: number,
  collectionCount: number,
): string | undefined {
  if (isLoading) return undefined;
  const materials = `${materialCount} ${materialCount === 1 ? 'material' : 'materials'}`;
  const collections = `${collectionCount} ${collectionCount === 1 ? 'collection' : 'collections'}`;
  return `${materials} · ${collections}`;
}

/** The switcher earns its place once there is something to switch between. */
export function shouldShowViewSwitcher(
  materialsLoading: boolean,
  collectionsLoading: boolean,
  materialCount: number,
  collectionCount: number,
): boolean {
  return materialsLoading || collectionsLoading || collectionCount > 0 || materialCount > 0;
}
