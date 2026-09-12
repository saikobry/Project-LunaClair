import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { FolderOpen, Plus } from 'lucide-react';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Checkbox } from '../../../shared/ui/Checkbox/Checkbox';
import { Button } from '../../../shared/ui/Button/Button';
import type { Collection } from '../../../domain/collections/models/Collection';
import { getCollectionIcon } from './collectionAppearance';

export interface ManageMaterialCollectionsModalProps {
    isOpen: boolean;
    materialId: string;
    materialTitle: string;
    collections: Collection[];
    assignedCollectionIds: string[];
    onToggle: (collectionId: string, assigned: boolean) => Promise<void> | void;
    onCreateNewCollection?: () => void;
    onClose: () => void;
}

const styles = stylex.create({
    subtitle: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
    materialTitle: {
        fontWeight: 600,
        color: 'var(--color-text-primary)',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    collectionRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background-surface)',
    },
    collectionIcon: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 8,
        flexShrink: 0,
        color: 'var(--color-text-secondary)',
    },
    checkboxGroup: {
        flex: 1,
        minWidth: 0,
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '32px 16px',
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
    },
    emptyIcon: {
        color: 'var(--color-text-disabled)',
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    emptyDescription: {
        fontSize: 12,
        margin: 0,
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        width: '100%',
    },
    footerActions: {
        display: 'flex',
        gap: 8,
    },
    togglingRow: {
        opacity: 0.55,
    },
});

export function ManageMaterialCollectionsModal({
    isOpen,
    materialId: _materialId, // part of the public contract; available for callers that need to key off the material
    materialTitle,
    collections,
    assignedCollectionIds,
    onToggle,
    onCreateNewCollection,
    onClose,
}: ManageMaterialCollectionsModalProps) {
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

    // Membership is re-checked for every row, so resolve it once per render.
    const assignedIdSet = new Set(assignedCollectionIds);

    const handleToggle = (collectionId: string, currentlyAssigned: boolean) => {
        setTogglingIds((prev) => {
            const next = new Set(prev);
            next.add(collectionId);
            return next;
        });

        const result = onToggle(collectionId, !currentlyAssigned);

        Promise.resolve(result).finally(() => {
            setTogglingIds((prev) => {
                const next = new Set(prev);
                next.delete(collectionId);
                return next;
            });
        });
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Add to Collection"
            width={460}
            footer={
                <div {...stylex.props(styles.footer)}>
                    {onCreateNewCollection && (
                        <Button
                            label="Create Collection"
                            variant="secondary"
                            icon={<Plus size={15} />}
                            onClick={onCreateNewCollection}
                        >
                            Create Collection
                        </Button>
                    )}
                    <div {...stylex.props(styles.footerActions)}>
                        <Button label="Done" variant="primary" onClick={onClose}>
                            Done
                        </Button>
                    </div>
                </div>
            }
        >
            <p {...stylex.props(styles.subtitle)}>
                Choose which collections include{' '}
                <span {...stylex.props(styles.materialTitle)}>{materialTitle}</span>.
            </p>

            {collections.length === 0 ? (
                <div {...stylex.props(styles.emptyState)}>
                    <FolderOpen size={40} {...stylex.props(styles.emptyIcon)} />
                    <p {...stylex.props(styles.emptyTitle)}>No collections created yet</p>
                    <p {...stylex.props(styles.emptyDescription)}>
                        Create a collection to group this material with others in a playlist.
                    </p>
                    {onCreateNewCollection && (
                        <Button
                            label="Create Collection"
                            variant="primary"
                            icon={<Plus size={15} />}
                            onClick={onCreateNewCollection}
                        >
                            Create Collection
                        </Button>
                    )}
                </div>
            ) : (
                <div role="group" aria-label="Collections" {...stylex.props(styles.list)}>
                    {collections.map((collection) => {
                        const isAssigned = assignedIdSet.has(collection.id);
                        const isToggling = togglingIds.has(collection.id);
                        const IconComponent = getCollectionIcon(collection.icon);
                        return (
                            <div
                                key={collection.id}
                                {...stylex.props(styles.collectionRow, isToggling && styles.togglingRow)}
                            >
                                <span
                                    aria-hidden="true"
                                    {...stylex.props(styles.collectionIcon)}
                                    style={collection.color ? { color: collection.color } : undefined}
                                >
                                    <IconComponent size={18} />
                                </span>
                                <div {...stylex.props(styles.checkboxGroup)}>
                                    <Checkbox
                                        label={collection.title}
                                        description={collection.description}
                                        isChecked={isAssigned}
                                        onChange={() => handleToggle(collection.id, isAssigned)}
                                        isDisabled={isToggling}
                                        aria-label={`Include ${collection.title} in ${materialTitle}`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Dialog>
    );
}

ManageMaterialCollectionsModal.displayName = 'ManageMaterialCollectionsModal';

export default ManageMaterialCollectionsModal;
