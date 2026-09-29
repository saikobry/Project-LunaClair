import { useState, useMemo, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  BookOpen,
  Loader2,
  Calendar,
  User,
  Lock,
  Download,
  Copy,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Page } from '../../../shared/ui/Page/Page';
import { Banner } from '../../../shared/ui/Banner/Banner';
import { Button } from '../../../shared/ui/Button/Button';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { Breadcrumbs, type BreadcrumbItem } from '../../../shared/ui/Breadcrumbs/Breadcrumbs';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';
import { ApplicationContext } from '../../providers/ApplicationContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';
import { useToast } from '../../providers/ToastContext';
import { useLocalOriginMaterials } from '../../../features/discovery/hooks/useLocalOriginMaterials';
import { inspectStudyPackage } from '../../../domain/package/engines/inspectStudyPackage';
import type { StudyPackageSummary } from '../../../domain/package/models/package.types';
import { PackageStatsGrid } from '../../../features/package/components/PackageStatsGrid';
import { QuestionTypeBreakdown } from '../../../features/package/components/QuestionTypeBreakdown';
import { formatPackageDate } from '../../../features/package/utils/packageFormat';
import { serializePackageToBlob } from '../../../domain/package/engines/StudyPackageSerializer';
import { sanitizeFilename, triggerBlobDownload } from '../../../shared/utils/fileDownload';
import type { AppRoute } from '../../routing/routing';
import type { PublishedShare } from '../../../domain/sharing/models/sharing.types';
import type { ImportStudyPackageResult } from '../../../application/use-cases/package/ImportStudyPackageUseCase';

export interface SharedPackageScreenProps {
  shareId: string;
  /**
   * Route the package was opened from (`?from=`, parsed). Its crumb and back
   * controls point there; absent for an external `/s/:code` link, which keeps
   * the Library default. `onCancel` performs the actual navigation — the screen
   * only names the destination.
   */
  from?: AppRoute;
  onOpenMaterial: (materialId: string) => void;
  onCancel: () => void;
}

type ScreenStatus = 'loading' | 'locked' | 'error' | 'ready';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    maxWidth: 900,
    width: '100%',
    margin: '0 auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    gap: 16,
    color: 'var(--color-text-secondary)',
  },
  loadingText: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  challengeCard: {
    maxWidth: 440,
    width: '100%',
    margin: '60px auto',
    padding: '32px 28px',
    borderRadius: 16,
    backgroundColor: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 20,
  },
  challengeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
    color: 'var(--color-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  challengePrompt: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.5,
  },
  challengeForm: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  passcodeInputGroup: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  passcodeIcon: {
    position: 'absolute',
    left: 12,
    color: 'var(--color-text-secondary)',
    pointerEvents: 'none',
  },
  passcodeInput: {
    width: '100%',
    padding: '10px 12px 10px 38px',
    fontSize: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    outlineStyle: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box',
    ':focus': {
      borderColor: 'var(--color-accent)',
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent)',
    },
  },
  passcodeErrorText: {
    fontSize: 13,
    color: 'var(--color-error)',
    margin: 0,
    textAlign: 'left',
  },
  challengeButtonsRow: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  card: {
    backgroundColor: 'var(--color-background-surface)',
    borderRadius: 14,
    border: '1px solid var(--color-border)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  metaHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  /** Material tags — the shared `Chip` vocabulary the library cards use. */
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 6,
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
    color: 'var(--color-accent)',
  },
  destinationGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    '@media (max-width: 580px)': {
      gridTemplateColumns: '1fr',
    },
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  select: {
    padding: '9px 12px',
    fontSize: 13,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-surface)',
    outlineStyle: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: 'var(--color-accent)',
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent)',
    },
  },
  actionsBar: {
    position: 'sticky',
    bottom: 16,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 20px',
    borderRadius: 14,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    flexWrap: 'wrap',
  },
  actionsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
});

/** Classifies a fetch/unlock failure into a passcode challenge vs a terminal error with a user-facing message. */
function classifyFetchError(err: unknown): { isPasscode: boolean; message: string } {
  const isPasscode =
    (err as { status?: number })?.status === 401 ||
    (err instanceof Error && /passcode|401|unauthorized/i.test(err.message));

  const httpStatus = (err as { status?: number })?.status;
  let message =
    err instanceof Error
      ? err.message
      : 'An unexpected error occurred while loading the shared package.';
  if (httpStatus === 404) {
    message = 'This shared study package could not be found or has been deleted.';
  } else if (httpStatus === 410) {
    message = 'This shared study package has expired.';
  }
  return { isPasscode, message };
}

/**
 * Where the visitor came from, as labels.
 *
 * The package is reachable from the Explore hub (in-app) or from a shared
 * `/s/:code` link (no in-app origin). `Explore` is claimed only when the parsed
 * origin route says so; a deep link keeps `Library` — which is also where a
 * cloned package ends up, so it is an honest destination rather than a guess.
 */
function shareOriginLabels(from?: AppRoute): { originLabel: string; backLabel: string } {
  return from?.kind === 'explore'
    ? { originLabel: 'Explore', backLabel: 'Back to Explore' }
    : { originLabel: 'Library', backLabel: 'Back to Library' };
}

/**
 * Trail for the share landing: origin → package.
 *
 * The last crumb is the package's own name once it is known — the same shape
 * the material workspace uses (`Library / {collection} / {material}`), so a
 * trail always ends with the thing you are looking at. `currentLabel` defaults
 * to the surface name for the states that cannot know it yet (loading,
 * passcode challenge, error) rather than showing an empty or invented title.
 */
function renderBreadcrumb(
  originLabel: string,
  onCancel: () => void,
  currentLabel = 'Shared Package',
) {
  const items: BreadcrumbItem[] = [
    { label: originLabel, onClick: onCancel },
    { label: currentLabel },
  ];
  return <Breadcrumbs items={items} />;
}

interface ScreenViewProps {
  onCancel: () => void;
  /** First crumb / where leaving the package returns to (origin-dependent). */
  originLabel: string;
}

function SharedPackageLoadingView({ onCancel, originLabel }: ScreenViewProps) {
  return (
    <Page title="Shared Study Package" breadcrumb={renderBreadcrumb(originLabel, onCancel)}>
      <div {...stylex.props(styles.loadingContainer)}>
        <Loader2 size={36} className="lucide-spin" />
        <p {...stylex.props(styles.loadingText)}>Loading shared study package...</p>
      </div>
    </Page>
  );
}

interface PasscodeChallengeProps extends ScreenViewProps {
  passcode: string;
  passcodeError: string | null;
  isUnlocking: boolean;
  onPasscodeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function PasscodeChallenge({
  passcode,
  passcodeError,
  isUnlocking,
  onPasscodeChange,
  onSubmit,
  onCancel,
  originLabel,
}: PasscodeChallengeProps) {
  return (
    <Page title="Shared Study Package" breadcrumb={renderBreadcrumb(originLabel, onCancel)}>
      <div {...stylex.props(styles.challengeCard)}>
        <div {...stylex.props(styles.challengeIconWrapper)}>
          <Lock size={26} />
        </div>
        <div>
          <h2 {...stylex.props(styles.challengeTitle)}>Passcode Protected</h2>
          <p {...stylex.props(styles.challengePrompt)} style={{ marginTop: 8 }}>
            This study package is passcode protected. Enter passcode to view.
          </p>
        </div>
        <form {...stylex.props(styles.challengeForm)} onSubmit={onSubmit}>
          <div {...stylex.props(styles.passcodeInputGroup)}>
            <KeyRound size={16} {...stylex.props(styles.passcodeIcon)} />
            <input
              type="password"
              aria-label="Passcode"
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => onPasscodeChange(e.target.value)}
              disabled={isUnlocking}
              {...stylex.props(styles.passcodeInput)}
            />
          </div>
          {passcodeError && (
            <p {...stylex.props(styles.passcodeErrorText)}>{passcodeError}</p>
          )}
          <div {...stylex.props(styles.challengeButtonsRow)}>
            <Button variant="secondary" label="Cancel" onClick={onCancel} isDisabled={isUnlocking}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              label="Unlock Package"
              isLoading={isUnlocking}
              isDisabled={isUnlocking || !passcode.trim()}
            >
              Unlock Package
            </Button>
          </div>
        </form>
      </div>
    </Page>
  );
}

interface PackageErrorViewProps extends ScreenViewProps {
  errorMessage: string | null;
  /** Back-control wording — `Back to Explore` when the hub was the origin. */
  backLabel: string;
}

function PackageErrorView({ errorMessage, onCancel, originLabel, backLabel }: PackageErrorViewProps) {
  return (
    <Page title="Shared Study Package" breadcrumb={renderBreadcrumb(originLabel, onCancel)}>
      <ErrorState
        icon={<AlertCircle size={44} />}
        title="Unable to load study package"
        description={errorMessage || 'This study package could not be loaded.'}
        action={
          <Button variant="secondary" label={backLabel} onClick={onCancel}>
            {backLabel}
          </Button>
        }
      />
    </Page>
  );
}

/**
 * Material tags carried by the package, so what you are about to clone is
 * visible before you clone it (they land on the imported material as-is).
 */
function PackageTagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div {...stylex.props(styles.tagRow)}>
      {tags.map((tag) => (
        <Chip key={tag} variant="neutral">
          #{tag}
        </Chip>
      ))}
    </div>
  );
}

function PackageMetaRow({
  summary,
  isProtected,
}: {
  summary: StudyPackageSummary;
  isProtected: boolean;
}) {
  return (
    <div {...stylex.props(styles.metaHeaderRow)}>
      {isProtected && (
        <span {...stylex.props(styles.badge)}>
          <ShieldCheck size={13} />
          Protected
        </span>
      )}
      {summary.author && (
        <span {...stylex.props(styles.metaItem)}>
          <User size={14} />
          {summary.author}
        </span>
      )}
      {summary.createdAt && (
        <span {...stylex.props(styles.metaItem)}>
          <Calendar size={14} />
          {formatPackageDate(summary.createdAt)}
        </span>
      )}
    </div>
  );
}

function CloneSuccessBanner({
  firstMaterialId,
  onOpenMaterial,
}: {
  firstMaterialId: string;
  onOpenMaterial: (materialId: string) => void;
}) {
  return (
    <Banner
      variant="success"
      title="Study package successfully cloned to your library!"
      action={
        firstMaterialId ? (
          <Button
            variant="primary"
            label="Open Cloned Material"
            icon={<BookOpen size={15} />}
            onClick={() => onOpenMaterial(firstMaterialId)}
          >
            Open Cloned Material
          </Button>
        ) : undefined
      }
    />
  );
}

interface SharedPackageActionsBarProps {
  isCloning: boolean;
  isDownloading: boolean;
  /** Back-control wording — `Back to Explore` when the hub was the origin. */
  backLabel: string;
  /**
   * This session cloned the share, so the success banner right above already
   * carries the open action — the bar stays in its confirmed state instead of
   * repeating it.
   */
  justCloned: boolean;
  /**
   * The local material this share already lives in, when known (this session's
   * clone, or an earlier one recognised through `originShareId`).
   */
  libraryMaterialId?: string;
  onCancel: () => void;
  onClone: () => void;
  onDownload: () => void;
  onOpenMaterial: (materialId: string) => void;
}

function SharedPackageActionsBar({
  isCloning,
  isDownloading,
  backLabel,
  justCloned,
  libraryMaterialId,
  onCancel,
  onClone,
  onDownload,
  onOpenMaterial,
}: SharedPackageActionsBarProps) {
  return (
    <div {...stylex.props(styles.actionsBar)}>
      <Button
        variant="secondary"
        label={backLabel}
        icon={<ArrowLeft size={15} />}
        onClick={onCancel}
        isDisabled={isCloning || isDownloading}
      >
        Back
      </Button>

      <div {...stylex.props(styles.actionsGroup)}>
        <Button
          variant="secondary"
          label="Download .lcpack"
          icon={<Download size={15} />}
          onClick={onDownload}
          isLoading={isDownloading}
          isDisabled={isDownloading || isCloning}
        >
          Download .lcpack
        </Button>
        {justCloned ? (
          <Button
            variant="primary"
            label="Cloned to Library"
            icon={<CheckCircle2 size={15} />}
            onClick={onClone}
            isDisabled
          >
            Cloned to Library
          </Button>
        ) : libraryMaterialId ? (
          // Already in the library (this visit or an earlier one): cloning again
          // would import a duplicate copy, so the primary action leads to the
          // local material instead.
          <Button
            variant="primary"
            label="Open in library"
            icon={<BookOpen size={15} />}
            onClick={() => onOpenMaterial(libraryMaterialId)}
            isDisabled={isCloning || isDownloading}
          >
            Open in library
          </Button>
        ) : (
          <Button
            variant="primary"
            label="Clone to Library"
            icon={<Copy size={15} />}
            onClick={onClone}
            isLoading={isCloning}
            isDisabled={isCloning || isDownloading}
          >
            Clone to Library
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Owns the fetch lifecycle (loading → ready / locked / error) and the
 * passcode unlock flow.
 */
function useSharedPackageFetch(shareId: string) {
  const context = useContextOrThrow(ApplicationContext, 'SharedPackageScreen');

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [share, setShare] = useState<PublishedShare | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const fetchedShare = await context.useCases.sharing.fetchPublishedShare.execute({
          shareId,
        });
        if (cancelled) return;
        setShare(fetchedShare);
        setStatus('ready');
      } catch (err: unknown) {
        if (cancelled) return;
        const { isPasscode, message } = classifyFetchError(err);
        if (isPasscode) {
          setStatus('locked');
        } else {
          setStatus('error');
          setErrorMessage(message);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [context, shareId]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = passcode.trim();
    if (!code) {
      setPasscodeError('Please enter a passcode.');
      return;
    }
    setIsUnlocking(true);
    setPasscodeError(null);
    setErrorMessage(null);

    try {
      const fetchedShare = await context.useCases.sharing.fetchPublishedShare.execute({
        shareId,
        passcode: code,
      });
      setShare(fetchedShare);
      setStatus('ready');
    } catch (err: unknown) {
      const { isPasscode, message } = classifyFetchError(err);
      if (isPasscode) {
        setStatus('locked');
        setPasscodeError('Incorrect passcode. Please try again.');
      } else {
        setStatus('error');
        setErrorMessage(message);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  return {
    status,
    share,
    passcode,
    passcodeError,
    isUnlocking,
    errorMessage,
    setPasscode,
    handleUnlock,
  };
}

/**
 * Owns clone/download actions, their busy flags, and
 * the success result banner state.
 */
function useSharedPackageActions(
  shareId: string,
  share: PublishedShare | null,
  queryClient: ReturnType<typeof useQueryClient>,
  showToast: ReturnType<typeof useToast>['showToast'],
) {
  const context = useContextOrThrow(ApplicationContext, 'SharedPackageScreen');

  const [isCloning, setIsCloning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [clonedResult, setClonedResult] = useState<ImportStudyPackageResult | null>(null);

  const handleClone = async () => {
    if (!share?.package || isCloning) return;
    setIsCloning(true);
    try {
      // `originShareId` is what makes this clone identifiable afterwards: it
      // records exact clone identity on the imported materials, so this screen
      // (and the Explore hub) can tell that the share is already in the library
      // instead of offering a second, duplicate clone.
      const result = await context.useCases.package.importStudyPackage.execute({
        package: share.package,
        originShareId: shareId,
      });

      // Strict requirement: ONLY after Dexie transaction succeeds, call trackShareDownload
      try {
        await context.useCases.sharing.trackShareDownload.execute({ shareId });
      } catch {
        // Non-blocking telemetry failure
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['materials'] }),
        queryClient.invalidateQueries({ queryKey: ['quizzes'] }),
        queryClient.invalidateQueries({ queryKey: ['questions'] }),
        queryClient.invalidateQueries({ queryKey: ['library'] }),
        queryClient.invalidateQueries({ queryKey: ['assessment'] }),
      ]);

      setClonedResult(result);
      showToast(
        `Successfully cloned "${share.package.metadata?.title ?? 'Study Package'}" to your library`,
        { intent: 'success' },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone study package.';
      showToast(message, { intent: 'error' });
    } finally {
      setIsCloning(false);
    }
  };

  const handleDownload = async () => {
    if (!share?.package || isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = serializePackageToBlob(share.package, true);
      const title = share.package.metadata?.title || share.title || 'study-package';
      const safeTitle = sanitizeFilename(title);
      const filename = `${safeTitle}.lcpack`;

      triggerBlobDownload(blob, filename);

      try {
        await context.useCases.sharing.trackShareDownload.execute({ shareId });
      } catch {
        // Non-blocking telemetry failure
      }

      showToast(`Downloaded "${safeTitle}.lcpack"`, {
        intent: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download study package.';
      showToast(message, { intent: 'error' });
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    isCloning,
    isDownloading,
    clonedResult,
    handleClone,
    handleDownload,
  };
}

export function SharedPackageScreen({
  shareId,
  from,
  onOpenMaterial,
  onCancel,
}: SharedPackageScreenProps) {
  const { originLabel, backLabel } = shareOriginLabels(from);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    status,
    share,
    passcode,
    passcodeError,
    isUnlocking,
    errorMessage,
    setPasscode,
    handleUnlock,
  } = useSharedPackageFetch(shareId);

  const summary = useMemo(() => {
    if (!share?.package) return null;
    return inspectStudyPackage(share.package);
  }, [share]);

  const {
    isCloning,
    isDownloading,
    clonedResult,
    handleClone,
    handleDownload,
  } = useSharedPackageActions(shareId, share, queryClient, showToast);

  /**
   * Membership outlives the session: this screen local state only knows about
   * a clone it performed itself, so a share cloned earlier (here or on the
   * Explore hub) used to look un-cloned on every fresh visit — and cloning it
   * again imported a duplicate. `originShareId` answers it persistently.
   */
  const localMaterialsByOrigin = useLocalOriginMaterials();
  const knownLibraryMaterialId = localMaterialsByOrigin.get(shareId);

  // 1. Loading State
  if (status === 'loading') {
    return <SharedPackageLoadingView onCancel={onCancel} originLabel={originLabel} />;
  }

  // 2. Locked (Passcode Challenge) State
  if (status === 'locked') {
    return (
      <PasscodeChallenge
        passcode={passcode}
        passcodeError={passcodeError}
        isUnlocking={isUnlocking}
        onPasscodeChange={setPasscode}
        onSubmit={handleUnlock}
        onCancel={onCancel}
        originLabel={originLabel}
      />
    );
  }

  // 3. Error State (404 / 410 / Network / Malformed payload)
  if (status === 'error' || !share || !summary) {
    return (
      <PackageErrorView
        errorMessage={errorMessage}
        onCancel={onCancel}
        originLabel={originLabel}
        backLabel={backLabel}
      />
    );
  }

  // 4. Ready / Unlocked State
  const questionTypeEntries = Object.entries(summary.questionsByType);
  const firstMaterialId =
    clonedResult?.materialIds[0] ||
    (share.package.materials[0]?.id
      ? clonedResult?.idMap.get(share.package.materials[0].id)
      : undefined) ||
    knownLibraryMaterialId ||
    '';

  // Resolved once and used twice (page heading + trail), so the two can never
  // disagree about what this package is called.
  const packageTitle = summary.title || share.title || 'Shared Study Package';

  return (
    <Page
      title={packageTitle}
      description={summary.description || share.description}
      breadcrumb={renderBreadcrumb(originLabel, onCancel, packageTitle)}
    >
      <div {...stylex.props(styles.container)}>
        <PackageMetaRow summary={summary} isProtected={share.accessType === 'passcode'} />

        <PackageTagRow tags={summary.tags} />

        {clonedResult && (
          <CloneSuccessBanner
            firstMaterialId={firstMaterialId}
            onOpenMaterial={onOpenMaterial}
          />
        )}

        {/* Summary Stat Cards */}
        <div {...stylex.props(styles.card)}>
          <h3 {...stylex.props(styles.sectionTitle)}>Package Contents</h3>
          <PackageStatsGrid summary={summary} />
        </div>

        {/* Question Type Breakdown */}
        <QuestionTypeBreakdown entries={questionTypeEntries} />

        {/* Actions Bar */}
        <SharedPackageActionsBar
          isCloning={isCloning}
          isDownloading={isDownloading}
          backLabel={backLabel}
          justCloned={!!clonedResult}
          // This session's clone wins (it is guaranteed to name the copy the
          // banner just opened); otherwise the persistent identity decides.
          libraryMaterialId={firstMaterialId || undefined}
          onCancel={onCancel}
          onClone={handleClone}
          onDownload={handleDownload}
          onOpenMaterial={onOpenMaterial}
        />
      </div>
    </Page>
  );
}

export default SharedPackageScreen;
