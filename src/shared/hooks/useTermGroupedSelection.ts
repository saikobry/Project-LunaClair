import { useState, useMemo, useCallback } from 'react';
import type { StudyMaterial, Term } from '../../domain/library';

export function useTermGroupedSelection(materials: StudyMaterial[], terms: Term[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sortedTerms = useMemo(
    () => terms.toSorted((a, b) => a.order - b.order),
    [terms],
  );

  const materialsByTerm = useMemo(() => {
    const map = new Map<string, StudyMaterial[]>();
    for (const term of sortedTerms) {
      const termMaterials = materials.filter((m) => m.termId === term.id);
      if (termMaterials.length > 0) map.set(term.id, termMaterials);
    }
    return map;
  }, [materials, sortedTerms]);

  const allIds = useMemo(() => materials.map((m) => m.id), [materials]);

  const toggleMaterial = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleTerm = useCallback(
    (termId: string) => {
      const ids = (materialsByTerm.get(termId) ?? []).map((m) => m.id);
      const allSelected = ids.every((id) => selectedIds.has(id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (allSelected) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        return next;
      });
    },
    [materialsByTerm, selectedIds],
  );

  const toggleAll = useCallback(() => {
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of allIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }, [allIds, selectedIds]);

  return {
    sortedTerms,
    materialsByTerm,
    allIds,
    selectedIds,
    toggleMaterial,
    toggleTerm,
    toggleAll,
    setSelectedIds,
  };
}
