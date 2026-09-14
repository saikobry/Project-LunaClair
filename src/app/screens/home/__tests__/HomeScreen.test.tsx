import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from '../HomeScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { GlobalAnalytics } from '../../../../domain/analytics/models/analytics.types';

describe('HomeScreen', () => {
  let queryClient: QueryClient;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockGetGlobalAnalytics: ReturnType<typeof vi.fn>;

  const now = new Date('2026-08-01T12:00:00.000Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  const materials: StudyMaterial[] = [
    {
      id: 'm-1',
      title: 'Kinematics',
      documentId: 'doc-1',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastOpenedAt: hoursAgo(2),
    },
    {
      id: 'm-2',
      title: 'Loose Note',
      documentId: 'doc-2',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastOpenedAt: hoursAgo(30),
    },
  ];

  const analytics: GlobalAnalytics = {
    overview: {
      quizzesCompleted: 4,
      totalAnsweredQuestions: 140,
      totalCorrectAnswers: 109,
      globalQuizAccuracy: 78,
      totalCardReviews: 220,
      cardsWithReviewHistory: 40,
      currentStreakDays: 12,
      longestStreakDays: 19,
    },
    maturity: {
      newCount: 10,
      learningCount: 8,
      reviewCount: 12,
      masteredCount: 10,
      totalCards: 40,
    },
    forecast: [
      { date: '2026-08-01', dueCount: 24, cumulativeDue: 24 },
      { date: '2026-08-02', dueCount: 3, cumulativeDue: 27 },
    ],
    activity: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetMaterials = vi.fn().mockResolvedValue(materials);
    mockGetGlobalAnalytics = vi.fn().mockResolvedValue(analytics);
  });

  function renderScreen(overrideMaterials?: StudyMaterial[]) {
    if (overrideMaterials) mockGetMaterials.mockResolvedValue(overrideMaterials);

    const mockContextValue = {
      repositories: {
        library: { getMaterials: mockGetMaterials },
        analytics: { getGlobalAnalytics: mockGetGlobalAnalytics },
      },
      useCases: { materials: {}, analytics: {} },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <HomeScreen
              onOpenMaterial={vi.fn()}
              onStartQuiz={vi.fn()}
              onNavigateToLibrary={vi.fn()}
              onNavigateToExplore={vi.fn()}
              onNavigateToImport={vi.fn()}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('continues the most recently opened material', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Continue studying')).toBeInTheDocument();
    });

    // m-1 was opened 2h ago, m-2 30h ago — m-1 heads the hero.
    expect(screen.getByRole('heading', { name: 'Kinematics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume Kinematics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start quiz for Kinematics' })).toBeInTheDocument();

    // The remaining material fills the Recent shelf.
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Loose Note/ })).toBeInTheDocument();
  });

  it('renders the study summary from global analytics', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Current streak')).toBeInTheDocument();
    });

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('Quiz accuracy')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('from 140 answered')).toBeInTheDocument();
  });

  it('renders quick actions into Explore, Import and Library', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quick actions' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Import a PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore study packages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse library' })).toBeInTheDocument();
  });

  it('shows the first-run empty state when the library has nothing in it', async () => {
    renderScreen([]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome.' })).toBeInTheDocument();
    });

    // The title intentionally avoids "Welcome to LunaClair", which the
    // first-run onboarding dialog already claims as a heading.
    expect(screen.getByText('Your library is empty')).toBeInTheDocument();

    // No dashboard regions on a fresh install.
    expect(screen.queryByText('Continue studying')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick actions')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore Study Packages/ })).toBeInTheDocument();

    // Import has no nav slot, so the empty state must keep it reachable.
    expect(screen.getByRole('button', { name: 'Import a PDF' })).toBeInTheDocument();
  });
});
