import { useEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { MaterialCard } from './MaterialCard';

/** Materials estimate; rows re-measure on mount so this only seeds layout. */
const ESTIMATED_ROW_HEIGHT = 240;
/** Mirrors the `minmax(280px, 1fr)` + 16px gap of the plain grid. */
const MIN_CARD_WIDTH = 280;
const GRID_GAP = 16;

export interface VirtualMaterialGridProps {
  materials: StudyMaterial[];
  onOpen: (material: StudyMaterial) => void;
  onEdit: (material: StudyMaterial) => void;
  onRemove: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  onNavigate?: (collectionId: string) => void;
  onToggleTag?: (tag: string) => void;
  selectedTags?: string[];
}

/**
 * Window-virtualized materials grid for large libraries (past
 * `VIRTUALIZE_AFTER_ITEM_COUNT`). Renders aligned rows in chunks of the live
 * lane count — derived from the measured container width with the same
 * formula the plain `auto-fill` grid resolves to — and measures each row so
 * variable card heights (tags, badges) stay correct.
 *
 * Cards are the same `MaterialCard`s as the plain path; only the positioning
 * wrapper differs, so small libraries never pay for this. No mount animation
 * here — recycled rows and enter-animations fight each other.
 */
export function VirtualMaterialGrid({
  materials,
  onOpen,
  onEdit,
  onRemove,
  onStartQuiz,
  onManage,
  onNavigate,
  onToggleTag,
  selectedTags,
}: VirtualMaterialGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Best guess before the first measurement; the observer corrects it.
  const isWide = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 641px)');
  const [measuredLanes, setMeasuredLanes] = useState<number | null>(null);
  const lanes = measuredLanes ?? (isWide ? 3 : isTablet ? 2 : 1);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const width = node.clientWidth;
      if (width > 0) {
        setMeasuredLanes(Math.max(1, Math.floor((width + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP))));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.max(1, Math.ceil(materials.length / lanes));

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 4,
    gap: GRID_GAP,
  });

  // Lane regrouping reuses index-keyed rows — drop cached heights so rows
  // re-measure instead of keeping a stale sibling's size.
  useEffect(() => {
    virtualizer.measure();
  }, [lanes, virtualizer]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div
        style={{ position: 'relative', height: `${virtualizer.getTotalSize()}px`, width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowMaterials = materials.slice(
            virtualRow.index * lanes,
            virtualRow.index * lanes + lanes,
          );
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))`,
                  gap: GRID_GAP,
                }}
              >
                {rowMaterials.map((material) => (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    onOpen={onOpen}
                    onEdit={onEdit}
                    onRemove={onRemove}
                    onStartQuiz={onStartQuiz}
                    onManage={onManage}
                    onNavigate={onNavigate}
                    onToggleTag={onToggleTag}
                    selectedTags={selectedTags}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
