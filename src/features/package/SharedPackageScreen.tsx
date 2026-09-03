import { useState, useMemo, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  BookOpen,
  HelpCircle,
  Award,
  Layers,
  Image as ImageIcon,
  Sparkles,
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
import { Page } from '../../shared/ui/Page/Page';
import { Button } from '../../shared/ui/Button/Button';
import { Breadcrumbs, type BreadcrumbItem } from '../../shared/ui/Breadcrumbs/Breadcrumbs';
import { ErrorState } from '../../shared/ui/ErrorState/ErrorState';
import { ApplicationContext } from '../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../shared/utils/contextGuard';
import { useToast } from '../../app/providers/ToastContext';
import { inspectStudyPackage } from '../../domain/package/engines/inspectStudyPackage';
import { serializePackageToBlob } from '../../domain/package/engines/StudyPackageSerializer';
import { sanitizeFilename, triggerBlobDownload } from '../../shared/utils/fileDownload';
import type { PublishedShare } from '../../domain/sharing/models/sharing.types';
import type { ImportStudyPackageResult } from '../../application/use-cases/package/ImportStudyPackageUseCase';
import { useSubjects } from '../catalog/subjects/hooks/queries/useSubjects';
import { useTerms } from '../catalog/terms/hooks/queries/useTerms';

export interface SharedPackageScreenProps {
  shareId: string;
  onOpenMaterial: (materialId: string, subjectId?: string) => void;
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
    backgroundColor: 'var(--color-background-surface, #ffffff)',
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
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: 'var(--color-primary, #6366f1)',
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
      borderColor: 'var(--color-primary, #6366f1)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
    },
  },
  passcodeErrorText: {
    fontSize: 13,
    color: 'var(--color-danger, #dc2626)',
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
    backgroundColor: 'var(--color-background-surface, #ffffff)',
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
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    color: 'var(--color-primary, #6366f1)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    '@media (max-width: 680px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '14px 16px',
    backgroundColor: 'var(--color-background-muted, #f9fafb)',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    gap: 6,
  },
  statCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
  typeBadgesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBadge: {
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-muted, #f9fafb)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
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
      borderColor: 'var(--color-primary, #6366f1)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
    },
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    gap: 16,
    flexWrap: 'wrap',
  },
  successBannerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: 'var(--color-success, #16a34a)',
    fontWeight: 600,
    fontSize: 14,
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
    backgroundColor: 'var(--color-background-surface, #ffffff)',
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

function formatQuestionType(type: string): string {
  switch (type) {
    case 'multiple_choice':
      return 'Multiple Choice';
    case 'multiple_select':
      return 'Multiple Select';
    case 'true_false':
      return 'True/False';
    case 'identification':
      return 'Identification';
    case 'fill_in_blank':
      return 'Fill in Blank';
    default:
      return type.replace(/_/g, ' ');
  }
}

function formatPackageDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function SharedPackageScreen({
  shareId,
  onOpenMaterial,
  onCancel,
}: SharedPackageScreenProps) {
  const context = useContextOrThrow(ApplicationContext, 'SharedPackageScreen');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [share, setShare] = useState<PublishedShare | null>(null);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [isCloning, setIsCloning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [clonedResult, setClonedResult] = useState<ImportStudyPackageResult | null>(null);

  const { subjects } = useSubjects();
  const { terms } = useTerms(selectedSubjectId || undefined);

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
        const isPasscodeError =
          (err as { status?: number })?.status === 401 ||
          (err instanceof Error && /passcode|401|unauthorized/i.test(err.message));

        if (isPasscodeError) {
          setStatus('locked');
        } else {
          setStatus('error');
          const httpStatus = (err as { status?: number })?.status;
          if (httpStatus === 404) {
            setErrorMessage('This shared study package could not be found or has been deleted.');
          } else if (httpStatus === 410) {
            setErrorMessage('This shared study package has expired.');
          } else {
            setErrorMessage(
              err instanceof Error
                ? err.message
                : 'An unexpected error occurred while loading the shared package.',
            );
          }
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
      const isPasscodeError =
        (err as { status?: number })?.status === 401 ||
        (err instanceof Error && /passcode|401|unauthorized/i.test(err.message));

      if (isPasscodeError) {
        setStatus('locked');
        setPasscodeError('Incorrect passcode. Please try again.');
      } else {
        setStatus('error');
        const httpStatus = (err as { status?: number })?.status;
        if (httpStatus === 404) {
          setErrorMessage('This shared study package could not be found or has been deleted.');
        } else if (httpStatus === 410) {
          setErrorMessage('This shared study package has expired.');
        } else {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while loading the shared package.',
          );
        }
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubjectId(e.target.value);
    setSelectedTermId('');
  };

  const summary = useMemo(() => {
    if (!share?.package) return null;
    return inspectStudyPackage(share.package);
  }, [share]);

  const handleClone = async () => {
    if (!share?.package || isCloning) return;
    setIsCloning(true);
    try {
      const result = await context.useCases.package.importStudyPackage.execute({
        package: share.package,
        targetSubjectId: selectedSubjectId || undefined,
        targetTermId: selectedTermId || undefined,
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
      showToast(`Successfully cloned "${summary?.title ?? 'Study Package'}" to your library`, {
        intent: 'success',
      });
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

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Library', onClick: onCancel },
    { label: 'Shared Package' },
  ];

  // 1. Loading State
  if (status === 'loading') {
    return (
      <Page title="Shared Study Package" breadcrumb={<Breadcrumbs items={breadcrumbItems} />}>
        <div {...stylex.props(styles.loadingContainer)}>
          <Loader2 size={36} className="lucide-spin" />
          <p {...stylex.props(styles.loadingText)}>Loading shared study package...</p>
        </div>
      </Page>
    );
  }

  // 2. Locked (Passcode Challenge) State
  if (status === 'locked') {
    return (
      <Page title="Shared Study Package" breadcrumb={<Breadcrumbs items={breadcrumbItems} />}>
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
          <form {...stylex.props(styles.challengeForm)} onSubmit={handleUnlock}>
            <div {...stylex.props(styles.passcodeInputGroup)}>
              <KeyRound size={16} {...stylex.props(styles.passcodeIcon)} />
              <input
                type="password"
                aria-label="Passcode"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={isUnlocking}
                autoFocus
                {...stylex.props(styles.passcodeInput)}
              />
            </div>
            {passcodeError && (
              <p {...stylex.props(styles.passcodeErrorText)}>{passcodeError}</p>
            )}
            <div {...stylex.props(styles.challengeButtonsRow)}>
              <Button
                variant="secondary"
                label="Cancel"
                onClick={onCancel}
                isDisabled={isUnlocking}
              >
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

  // 3. Error State (404 / 410 / Network / Malformed payload)
  if (status === 'error' || !share || !summary) {
    return (
      <Page title="Shared Study Package" breadcrumb={<Breadcrumbs items={breadcrumbItems} />}>
        <ErrorState
          icon={<AlertCircle size={44} />}
          title="Unable to load study package"
          description={errorMessage || 'This study package could not be loaded.'}
          action={
            <Button variant="secondary" label="Back to Library" onClick={onCancel}>
              Back to Library
            </Button>
          }
        />
      </Page>
    );
  }

  // 4. Ready / Unlocked State
  const questionTypeEntries = Object.entries(summary.questionsByType);
  const firstMaterialId =
    clonedResult?.materialIds[0] ||
    (share.package.materials[0]?.id
      ? clonedResult?.idMap.get(share.package.materials[0].id)
      : undefined) ||
    '';

  return (
    <Page
      title={summary.title || share.title || 'Shared Study Package'}
      description={summary.description || share.description}
      breadcrumb={<Breadcrumbs items={breadcrumbItems} />}
    >
      <div {...stylex.props(styles.container)}>
        {/* Header Metadata */}
        <div {...stylex.props(styles.metaHeaderRow)}>
          {share.accessType === 'passcode' && (
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

        {/* Success Banner if cloned */}
        {clonedResult && (
          <div {...stylex.props(styles.successBanner)}>
            <div {...stylex.props(styles.successBannerInfo)}>
              <CheckCircle2 size={20} />
              <span>Study package successfully cloned to your library!</span>
            </div>
            {firstMaterialId && (
              <Button
                variant="primary"
                label="Open Cloned Material"
                icon={<BookOpen size={15} />}
                onClick={() => onOpenMaterial(firstMaterialId, selectedSubjectId || undefined)}
              >
                Open Cloned Material
              </Button>
            )}
          </div>
        )}

        {/* Summary Stat Cards */}
        <div {...stylex.props(styles.card)}>
          <h3 {...stylex.props(styles.sectionTitle)}>Package Contents</h3>
          <div {...stylex.props(styles.statsGrid)}>
            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <BookOpen size={15} />
                <span>Materials</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.materialCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <HelpCircle size={15} />
                <span>Questions</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.questionCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <Award size={15} />
                <span>Quizzes</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.quizCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <Layers size={15} />
                <span>Flashcards</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.flashcardCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <ImageIcon size={15} />
                <span>Assets</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.assetCount}</span>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statCardHeader)}>
                <Sparkles size={15} />
                <span>Total Points</span>
              </div>
              <span {...stylex.props(styles.statCardValue)}>{summary.totalPoints}</span>
            </div>
          </div>
        </div>

        {/* Question Type Breakdown */}
        {questionTypeEntries.length > 0 && (
          <div {...stylex.props(styles.card)}>
            <h3 {...stylex.props(styles.sectionTitle)}>Question Types</h3>
            <div {...stylex.props(styles.typeBadgesList)}>
              {questionTypeEntries.map(([type, count]) => (
                <span key={type} {...stylex.props(styles.typeBadge)}>
                  {formatQuestionType(type)}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Destination Selector */}
        <div {...stylex.props(styles.card)}>
          <h3 {...stylex.props(styles.sectionTitle)}>Destination in Library</h3>
          <div {...stylex.props(styles.destinationGrid)}>
            <div {...stylex.props(styles.fieldGroup)}>
              <label htmlFor="share-dest-subject" {...stylex.props(styles.label)}>
                Subject (Optional)
              </label>
              <select
                id="share-dest-subject"
                aria-label="Subject (Optional)"
                {...stylex.props(styles.select)}
                value={selectedSubjectId}
                onChange={handleSubjectChange}
                disabled={isCloning || !!clonedResult}
              >
                <option value="">Unassigned (General Library)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div {...stylex.props(styles.fieldGroup)}>
              <label htmlFor="share-dest-term" {...stylex.props(styles.label)}>
                Term (Optional)
              </label>
              <select
                id="share-dest-term"
                aria-label="Term (Optional)"
                {...stylex.props(styles.select)}
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                disabled={isCloning || !!clonedResult || terms.length === 0}
              >
                <option value="">No Term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div {...stylex.props(styles.actionsBar)}>
          <Button
            variant="secondary"
            label="Back to Library"
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
              onClick={handleDownload}
              isLoading={isDownloading}
              isDisabled={isDownloading || isCloning}
            >
              Download .lcpack
            </Button>
            <Button
              variant="primary"
              label={clonedResult ? 'Cloned to Library' : 'Clone to Library'}
              icon={clonedResult ? <CheckCircle2 size={15} /> : <Copy size={15} />}
              onClick={handleClone}
              isLoading={isCloning}
              isDisabled={isCloning || isDownloading || !!clonedResult}
            >
              {clonedResult ? 'Cloned to Library' : 'Clone to Library'}
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}

export default SharedPackageScreen;
