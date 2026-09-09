import { useRef, useEffect, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookText, GraduationCap, Plus } from 'lucide-react';
import gsap from 'gsap';
import type { ViewportNavProps } from './navigation.types';
import { PRIMARY_NAV_ITEMS } from './navItems';
import { styles } from './desktopSidebar.stylex';
import { DesktopTrapezoidButton } from './DesktopTrapezoidButton';
import { useCollections } from '../../../features/collections/hooks/queries/useCollections';
import { useCreateCollection } from '../../../features/collections/hooks/mutations/useCreateCollection';
import { CreateCollectionModal } from '../../../features/collections/modals/CreateCollectionModal';
import { getCollectionIcon } from '../../../features/collections/modals/collectionAppearance';
import { Button } from '../../../shared/ui/Button/Button';
import type { CreateCollectionInput } from '../../../domain/collections/models/Collection';

interface SubjectMaterialNavProps {
  active: ViewportNavProps['active'];
  onNavigate: ViewportNavProps['onNavigate'];
  subject?: ViewportNavProps['subject'];
  material?: ViewportNavProps['material'];
}

function SubjectMaterialNav({ active, onNavigate, subject, material }: SubjectMaterialNavProps) {
  const isSubjectActive = active === 'none' && Boolean(subject) && !material;
  const isMaterialActive = active === 'none' && Boolean(material);

  if (active !== 'none') return null;

  return (
    <>
      <div {...stylex.props(styles.divider)} aria-hidden="true" />

      {subject && (
        <button
          type="button"
          {...stylex.props(styles.navItem, isSubjectActive && styles.navItemActive)}
          onClick={() =>
            onNavigate({
              kind: 'subject',
              subjectId: subject.id,
              activeTab: 'materials',
            })
          }
          aria-current={isSubjectActive ? 'page' : undefined}
          title={`Subject: ${subject.title}`}
        >
          <GraduationCap size={18} />
          <span {...stylex.props(styles.navLabel)}>{subject.title}</span>
        </button>
      )}

      {material && (
        <button
          type="button"
          {...stylex.props(styles.navItem, isMaterialActive && styles.navItemMaterialActive)}
          onClick={() =>
            onNavigate({
              kind: 'workspace',
              workspace: 'material',
              materialId: material.id,
              activeTab: 'read',
            })
          }
          aria-current={isMaterialActive ? 'page' : undefined}
          title={`Material: ${material.title}`}
        >
          <BookText size={18} />
          <span {...stylex.props(styles.navLabel)}>{material.title}</span>
        </button>
      )}
    </>
  );
}

/**
 * Dynamic Collections section: browsable playlist nav items with a quick-add
 * button that opens `CreateCollectionModal` and navigates to the new
 * collection on save. Always visible — collection discovery is the point.
 */
function CollectionsNav({
  activeCollectionId,
  onNavigate,
}: {
  activeCollectionId?: string | null;
  onNavigate: ViewportNavProps['onNavigate'];
}) {
  const { collections } = useCollections();
  const createMutation = useCreateCollection();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleSave = async (input: CreateCollectionInput) => {
    const created = await createMutation.mutateAsync(input);
    setIsCreateOpen(false);
    onNavigate({ kind: 'collection', collectionId: created.id });
  };

  return (
    <>
      <div {...stylex.props(styles.divider)} aria-hidden="true" />

      <div {...stylex.props(styles.sectionHeader)}>
        <span {...stylex.props(styles.sectionLabel)}>Collections</span>
        <Button
          label="New Collection"
          tooltip="New Collection"
          isIconOnly
          variant="ghost"
          icon={<Plus size={16} />}
          onClick={() => setIsCreateOpen(true)}
        />
      </div>

      {collections.map((collection) => {
        const isActive = activeCollectionId === collection.id;
        const Icon = getCollectionIcon(collection.icon);
        return (
          <button
            key={collection.id}
            type="button"
            {...stylex.props(styles.navItem, isActive && styles.navItemActive)}
            onClick={() => onNavigate({ kind: 'collection', collectionId: collection.id })}
            aria-current={isActive ? 'page' : undefined}
            title={`Collection: ${collection.title}`}
          >
            <span
              {...stylex.props(styles.collectionIcon)}
              style={collection.color ? { color: collection.color } : undefined}
            >
              <Icon size={18} />
            </span>
            <span {...stylex.props(styles.navLabel)}>{collection.title}</span>
          </button>
        );
      })}

      <CreateCollectionModal
        isOpen={isCreateOpen}
        onSave={handleSave}
        onClose={() => setIsCreateOpen(false)}
      />
    </>
  );
}

export function DesktopSidebar({
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
  subject,
  material,
  collectionId,
}: ViewportNavProps) {
  const containerRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const didInitialFade = useRef(false);

  // ── GSAP: Upper navigation link & container background fade ──
  useEffect(() => {
    const links = linksRef.current;
    const container = containerRef.current;
    if (!links || !container) return;

    if (!didInitialFade.current) {
      didInitialFade.current = true;
      if (isFocusMode) {
        gsap.set(links, { autoAlpha: 0, pointerEvents: 'none' });
        gsap.set(container, { backgroundColor: 'transparent', borderColor: 'transparent' });
      } else {
        gsap.set(links, { autoAlpha: 1, pointerEvents: 'auto' });
        gsap.set(container, { clearProps: 'backgroundColor,borderColor' });
      }
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    if (isFocusMode) {
      tl.to(links, {
        autoAlpha: 0,
        y: 16,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(links, { pointerEvents: 'none' });
        },
      }, 0);

      tl.to(container, {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        duration: 0.24,
      }, 0.04);
    } else {
      tl.to(container, {
        backgroundColor: 'var(--color-background-surface)',
        borderColor: 'var(--color-border)',
        duration: 0.28,
        ease: 'power2.out',
      }, 0);

      gsap.set(links, { pointerEvents: 'auto' });
      tl.fromTo(links,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out' },
        0.12
      );
    }
  }, [isFocusMode]);

  return (
    <nav
      ref={containerRef}
      {...stylex.props(styles.desktopNav)}
      aria-label="Desktop Navigation"
    >
      <div ref={linksRef} {...stylex.props(styles.linksWrapper)}>
        <div {...stylex.props(styles.navSection)}>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = item.isActive(active);
            return (
              <button
                key={item.id}
                type="button"
                {...stylex.props(styles.navItem, isActive && styles.navItemActive)}
                onClick={() => onNavigate(item.route)}
                aria-current={isActive ? 'page' : undefined}
                title={item.title}
              >
                <item.icon size={18} />
                <span {...stylex.props(styles.navLabel)}>{item.label}</span>
              </button>
            );
          })}

          <SubjectMaterialNav
            active={active}
            onNavigate={onNavigate}
            subject={subject}
            material={material}
          />

          <CollectionsNav
            activeCollectionId={collectionId}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* Connected Option A Rounded Trapezoid Drawer Button */}
      <DesktopTrapezoidButton
        isFocusMode={isFocusMode}
        onToggleFocusMode={onToggleFocusMode}
      />
    </nav>
  );
}
