import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  BookHeart,
  BrainCircuit,
  ChevronRight,
  Compass,
  Flame,
  CalendarClock,
  FileUp,
  LibraryBig,
  Play,
  Plus,
  Target,
} from 'lucide-react';
import type { QuizLaunchRequest } from '../../../features/quiz/types/quizFeature.types';
import { useLibrary } from '../../../features/materials/hooks/queries/useLibrary';
import { useGlobalAnalytics } from '../../../features/analytics/hooks/queries/useGlobalAnalytics';
import { useCreateMaterial } from '../../../features/materials/hooks/mutations/useCreateMaterial';
import CreateMaterialModal from '../../../features/materials/modals/CreateMaterialModal';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { CardGridSkeleton } from '../../../shared/ui/Skeleton/Skeleton';
import { formatRelativeTime } from '../../../shared/utils/date';
import { useRecentMaterials } from './hooks/useRecentMaterials';
import { useHomeStats } from './hooks/useHomeStats';
import { styles } from './styles/home.stylex';

export interface HomeScreenProps {
  onOpenMaterial: (materialId: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onNavigateToLibrary: () => void;
  onNavigateToExplore: () => void;
  onNavigateToImport: () => void;
}

/**
 * Home — "what should I do next?"
 *
 * A dashboard, not a catalogue: it surfaces the most recently opened material,
 * the learner's headline numbers, a recent shelf, and the primary quick actions.
 * The full library lives at `/library`.
 */
export function HomeScreen({
  onOpenMaterial,
  onStartQuiz,
  onNavigateToLibrary,
  onNavigateToExplore,
  onNavigateToImport,
}: HomeScreenProps) {
  const { materials, isLoading: materialsLoading } = useLibrary();
  const { analytics, isLoading: analyticsLoading } = useGlobalAnalytics();
  const createMutation = useCreateMaterial();

  const [showCreateMaterial, setShowCreateMaterial] = useState(false);

  // Recency model (hero + recent shelf) lives in `useRecentMaterials`.
  const { hero, recent } = useRecentMaterials(materials);
  const { streakDays, dueToday, accuracy, answered, hasStats } = useHomeStats(analytics);

  const handleStartHeroQuiz = useCallback(() => {
    if (!hero) return;
    onStartQuiz({ type: 'quiz', quizId: hero.id, materialId: hero.id, source: 'library' });
  }, [hero, onStartQuiz]);

  const handleOpenRecent = useCallback(
    (materialId: string) => {
      onOpenMaterial(materialId);
    },
    [onOpenMaterial],
  );

  const handleCreateMaterialSave = useCallback(
    (title: string, description: string, tags?: string[]) => {
      createMutation.mutate({ title, description, tags });
      setShowCreateMaterial(false);
    },
    [createMutation],
  );

  const handleCreateMaterialClose = useCallback(() => {
    setShowCreateMaterial(false);
  }, []);

  // ── First run: nothing to continue and nothing to measure ──
  if (!materialsLoading && materials.length === 0) {
    return (
      <Page title="Welcome." description="Let's get you set up.">
        <EmptyState
          icon={<BookHeart size={56} />}
          title="Your library is empty"
          description="Explore study packages on the Explore hub and clone them to your library, or bring your own notes in as a PDF. Cloned packages are available offline, including their quizzes."
          action={
            <Button
              label="Explore Study Packages"
              variant="primary"
              icon={<LibraryBig size={18} />}
              onClick={onNavigateToExplore}
            >
              Explore Study Packages
            </Button>
          }
          // Import has no nav slot, so the first-run state must keep it reachable —
          // quick actions only render once the library has content.
          secondaryAction={
            <Button
              label="Import a PDF"
              variant="secondary"
              icon={<FileUp size={18} />}
              onClick={onNavigateToImport}
            >
              Import a PDF
            </Button>
          }
        />
      </Page>
    );
  }

  return (
    <>
      <Page
        title="Welcome back."
        description={
          dueToday > 0
            ? `${dueToday} ${dueToday === 1 ? 'card' : 'cards'} due for review today.`
            : 'Pick up where you left off.'
        }
        actions={
          <Button
            label="New Material"
            variant="primary"
            icon={<Plus size={18} />}
            onClick={() => setShowCreateMaterial(true)}
          >
            New Material
          </Button>
        }
      >
        {materialsLoading && <CardGridSkeleton count={3} />}

        {!materialsLoading && hero && (
          <section {...stylex.props(styles.hero)} aria-labelledby="home-continue-heading">
            <div {...stylex.props(styles.heroLead)}>
              <span {...stylex.props(styles.heroIcon)} aria-hidden="true">
                <BookHeart size={24} />
              </span>
              <div {...stylex.props(styles.heroBody)}>
                <p {...stylex.props(styles.heroEyebrow)}>Continue studying</p>
                <h2 id="home-continue-heading" {...stylex.props(styles.heroTitle)}>
                  {hero.title}
                </h2>
                <p {...stylex.props(styles.heroMeta)}>
                  Last opened {formatRelativeTime(hero.lastOpenedAt)}
                </p>
              </div>
            </div>
            <div {...stylex.props(styles.heroActions)}>
              <Button
                label={`Resume ${hero.title}`}
                variant="primary"
                icon={<Play size={16} />}
                onClick={() => onOpenMaterial(hero.id)}
              >
                Resume
              </Button>
              <Button
                label={`Start quiz for ${hero.title}`}
                variant="secondary"
                icon={<BrainCircuit size={16} />}
                onClick={handleStartHeroQuiz}
              >
                Start Quiz
              </Button>
            </div>
          </section>
        )}

        {!analyticsLoading && hasStats && (
          <section {...stylex.props(styles.statStrip)} aria-label="Study summary">
            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statLabelRow)}>
                <span>Current streak</span>
                <Flame size={17} aria-hidden="true" />
              </div>
              <p {...stylex.props(styles.statValue)}>{streakDays}</p>
              <p {...stylex.props(styles.statNote)}>
                {streakDays === 1 ? 'day in a row' : 'days in a row'}
              </p>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statLabelRow)}>
                <span>Due today</span>
                <CalendarClock size={17} aria-hidden="true" />
              </div>
              <p {...stylex.props(styles.statValue)}>{dueToday}</p>
              <p {...stylex.props(styles.statNote)}>
                {dueToday === 1 ? 'card waiting' : 'cards waiting'}
              </p>
            </div>

            <div {...stylex.props(styles.statCard)}>
              <div {...stylex.props(styles.statLabelRow)}>
                <span>Quiz accuracy</span>
                <Target size={17} aria-hidden="true" />
              </div>
              <p {...stylex.props(styles.statValue)}>{Math.round(accuracy)}%</p>
              <p {...stylex.props(styles.statNote)}>from {answered} answered</p>
            </div>
          </section>
        )}

        {!materialsLoading && recent.length > 0 && (
          <section {...stylex.props(styles.section)} aria-labelledby="home-recent-heading">
            <div {...stylex.props(styles.sectionHeader)}>
              <h2 id="home-recent-heading" {...stylex.props(styles.sectionTitle)}>
                Recent
              </h2>
              <Button
                label="See all materials in your Library"
                variant="ghost"
                onClick={onNavigateToLibrary}
              >
                See all
              </Button>
            </div>
            <div {...stylex.props(styles.recentGrid)}>
              {recent.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => handleOpenRecent(material.id)}
                  {...stylex.props(styles.recentCard)}
                  title={`Open ${material.title}`}
                >
                  <span {...stylex.props(styles.recentIcon)} aria-hidden="true">
                    <BookHeart size={18} />
                  </span>
                  <span {...stylex.props(styles.recentBody)}>
                    <span {...stylex.props(styles.recentTitle)}>{material.title}</span>
                    <span {...stylex.props(styles.recentMeta)}>
                      {formatRelativeTime(material.lastOpenedAt)}
                    </span>
                  </span>
                  <ChevronRight size={18} style={{ color: 'var(--color-text-disabled)' }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}

        <section {...stylex.props(styles.section)} aria-labelledby="home-actions-heading">
          <div {...stylex.props(styles.sectionHeader)}>
            <h2 id="home-actions-heading" {...stylex.props(styles.sectionTitle)}>
              Quick actions
            </h2>
          </div>
          <div {...stylex.props(styles.quickActions)}>
            <Button
              label="New Material"
              variant="secondary"
              icon={<Plus size={16} />}
              onClick={() => setShowCreateMaterial(true)}
            >
              New Material
            </Button>
            <Button
              label="Import a PDF"
              variant="secondary"
              icon={<FileUp size={16} />}
              onClick={onNavigateToImport}
            >
              Import a PDF
            </Button>
            <Button
              label="Explore study packages"
              variant="secondary"
              icon={<Compass size={16} />}
              onClick={onNavigateToExplore}
            >
              Explore study packages
            </Button>
            <Button
              label="Browse library"
              variant="secondary"
              icon={<LibraryBig size={16} />}
              onClick={onNavigateToLibrary}
            >
              Browse library
            </Button>
          </div>
        </section>
      </Page>

      {showCreateMaterial && (
        <CreateMaterialModal
          onSave={handleCreateMaterialSave}
          onClose={handleCreateMaterialClose}
        />
      )}
    </>
  );
}

export default HomeScreen;
