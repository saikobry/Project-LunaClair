import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MaterialWorkspaceScreen from '../MaterialWorkspaceScreen';
import type { AppRoute } from '../../../routing/routing';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

// The screen's data hooks are stubbed: this suite is about the screen's OWN launch-intent
// state, and every panel is a stub, so nothing below the header is under test here.
vi.mock('../../../../features/materials/hooks/queries/useMaterial', () => ({
    useMaterial: (materialId: string) => ({
        material: {
            id: materialId,
            title: `Material ${materialId}`,
            documentId: `doc-${materialId}`,
            description: '',
            tags: [],
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
        } as StudyMaterial,
        isLoading: false,
    }),
}));
vi.mock('../../../../features/collections/hooks/queries/useCollection', () => ({
    useCollection: () => ({ collection: null }),
}));
vi.mock('../../../../features/reader/hooks/useDocument', () => ({
    useDocument: () => ({ data: undefined }),
}));
vi.mock('../../../../features/reader/hooks/useMaterialAssets', () => ({
    useMaterialAssets: () => undefined,
}));
vi.mock('../hooks/useWorkspaceAssets', () => ({
    useWorkspaceAssets: () => ({ assets: [] }),
}));

// Header chrome, not the subject: it reaches for the application graph (`useExportStudyPackage`).
vi.mock('../components/WorkspaceActions', () => ({ WorkspaceActions: () => null }));

// The panels are the screen's only reader of the launch channel, so the stub is where a test
// reads "what is armed" and drives the two commands: arming (the Flashcards handoff) and
// retiring. A fresh object each click is deliberate — retirement is by identity, so a test that
// wants to retire a DIFFERENT intent needs a different object.
vi.mock('../components/WorkspaceTabPanels', () => ({
    WorkspaceTabPanels: ({ generatorLaunch, onGenerateCards }: any) => (
        <>
            <span data-testid="channel-intent">
                {generatorLaunch.intent ? generatorLaunch.intent.materialId : 'none'}
            </span>
            <button onClick={onGenerateCards}>arm-launch</button>
            <button
                onClick={() =>
                    generatorLaunch.onRetire({
                        materialId: 'mat-somewhere-else',
                        requestedTypes: ['true_false'],
                        returnTo: { tab: 'flashcards', label: 'Someone else’s launch' },
                    })
                }
            >
                retire-foreign
            </button>
        </>
    ),
}));

describe('MaterialWorkspaceScreen — the one-shot launch intent', () => {
    let onNavigate: ReturnType<typeof vi.fn<(route: AppRoute) => void>>;

    beforeEach(() => {
        vi.clearAllMocks();
        onNavigate = vi.fn();
    });

    const screen_ = (materialId: string) => (
        <MaterialWorkspaceScreen materialId={materialId} activeTab="read" onNavigate={onNavigate} />
    );

    /**
     * A launch is addressed to ONE material's Question Bank, and this screen instance is reused
     * when the route's material changes (`ShellRoutes` renders it without a `key`). So the
     * pending intent must expire with the material it was armed for: carried across, it sits
     * armed against a different material's workspace — where the Bank's own material check
     * declines it — and fires the generator the moment the user returns to the first material,
     * long after the request was made.
     */
    it('expires an armed launch when the workspace moves to another material', () => {
        const { rerender } = render(screen_('mat-1'));

        fireEvent.click(screen.getByText('arm-launch'));
        expect(screen.getByTestId('channel-intent')).toHaveTextContent('mat-1');
        // The handoff also makes the ordinary `?tab=questions` change — the intent is state on
        // top of the tab route, never a replacement for it.
        expect(onNavigate).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'workspace', materialId: 'mat-1', activeTab: 'questions' }),
        );

        // Off to another material.
        rerender(screen_('mat-2'));
        expect(screen.getByTestId('channel-intent')).toHaveTextContent('none');
    });

    it('does not re-fire an expired launch when the user returns to the first material', () => {
        const { rerender } = render(screen_('mat-1'));

        fireEvent.click(screen.getByText('arm-launch'));
        expect(screen.getByTestId('channel-intent')).toHaveTextContent('mat-1');

        // Navigate away and back — the same screen instance, the same React state slot.
        rerender(screen_('mat-2'));
        rerender(screen_('mat-1'));

        // Nothing is pending, so returning to the first material cannot resurrect the request.
        expect(screen.getByTestId('channel-intent')).toHaveTextContent('none');
    });

    it('keeps an armed launch across re-renders of the SAME material', () => {
        // The guard the expiry needs is the material comparison, not "any re-render": the screen
        // re-renders constantly (queries resolve, assets arrive, the tab strip redraws), and an
        // over-eager expiry would drop every launch before the Bank could claim it.
        const { rerender } = render(screen_('mat-1'));

        fireEvent.click(screen.getByText('arm-launch'));
        rerender(screen_('mat-1'));
        rerender(screen_('mat-1'));

        expect(screen.getByTestId('channel-intent')).toHaveTextContent('mat-1');
    });

    it('ignores a retirement that names an intent it is not holding', () => {
        // Supersession, owner half. The channel's `onRetire` takes the intent it retires, so a
        // dialog that a newer launch already replaced cannot clear the launch that replaced it.
        // An owner that emptied its state unconditionally would strand nothing here — it would
        // destroy a launch that is still perfectly valid.
        render(screen_('mat-1'));

        fireEvent.click(screen.getByText('arm-launch'));
        expect(screen.getByTestId('channel-intent')).toHaveTextContent('mat-1');

        fireEvent.click(screen.getByText('retire-foreign'));

        expect(screen.getByTestId('channel-intent')).toHaveTextContent('mat-1');
    });
});
