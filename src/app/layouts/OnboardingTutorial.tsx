import { useCallback, useContext, useEffect, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Sparkles, X } from 'lucide-react';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { Button } from '../../shared/ui/Button/Button';
import logoSvg from '../../assets/logo.svg';
import { ApplicationContext } from '../providers/ApplicationContext';
import { useToast } from '../providers/ToastContext';

/**
 * First-run onboarding tutorial (app-shell chrome).
 *
 * A FULL-SCREEN takeover (not a dialog card) — the entire viewport becomes
 * the onboarding screen: brand header with Skip, centered hero slide, and a
 * bottom action bar with progress dots + a full-width CTA. One-time and
 * skippable, persisted via `STORAGE_KEYS.settings.onboardingDone`.
 *
 * The tutorial is bundled app chrome — it never depends on the network — but
 * its Finish AND Skip actions call `SyncDefaultTermsUseCase`, which syncs the
 * canonical academic terms (Prelim / Midterm / Finals) from the SW-cached
 * catalog into Dexie, so dismissal is never punished. Terms additionally
 * arrive via import (which writes its own term rows).
 *
 * Unlike the PWA install surfaces, this is NOT gated off in dev — onboarding
 * is a real product flow and must be testable locally.
 */

const SLIDES = [
  {
    icon: Sparkles,
    title: 'Welcome to LunaClair',
    body: 'An AI-powered learning platform that works offline — study materials, quizzes, and flashcards, all in one place.',
  },
  {
    icon: BookOpen,
    title: 'Your library, your choice',
    body: 'Browse Available Materials and add what you want to study. Subjects, materials, and terms live in your library.',
  },
  {
    icon: GraduationCap,
    title: 'Terms & quizzes',
    body: 'Organize by academic terms — Prelim, Midterm, Finals — and test yourself with quizzes and flashcards.',
  },
  {
    icon: CheckCircle2,
    title: "You're all set",
    body: 'Finishing prepares your default terms and marks you ready to start studying.',
  },
] as const;

interface OnboardingTutorialProps {
  /** Hide while immersive routes (quiz session/canvas) own the screen. */
  suppressed?: boolean;
}

export function OnboardingTutorial({ suppressed = false }: OnboardingTutorialProps) {
  const { useCases } = useContext(ApplicationContext) ?? {};
  const { showToast } = useToast();

  // Shown until finished OR skipped — one-time per browser.
  const [done, setDone] = useState(
    () => localStorage.getItem(STORAGE_KEYS.settings.onboardingDone) === '1',
  );
  const [step, setStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const show = !suppressed && !done;
  const isLastStep = step === SLIDES.length - 1;

  const markDone = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.settings.onboardingDone, '1');
    setDone(true);
  }, []);

  const syncDefaultTerms = useCallback(async () => {
    try {
      const result = await useCases?.library.syncDefaultTerms.execute();
      if (result?.synced && result.count > 0) {
        showToast('Default terms ready — Prelim, Midterm, Finals', { intent: 'success' });
      }
    } catch {
      // Failure-tolerant — terms arrive later via import.
    }
  }, [useCases, showToast]);

  const handleSkip = useCallback(() => {
    // Skip syncs the same way as Finish — dismissal is never punished, and
    // default terms land in Dexie either way. Fire-and-forget so Skip stays
    // an instant dismiss; the success toast confirms the sync.
    void syncDefaultTerms();
    markDone();
  }, [syncDefaultTerms, markDone]);

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    await syncDefaultTerms();
    markDone();
  }, [syncDefaultTerms, markDone]);

  // Escape dismisses the tutorial (same semantics as Skip).
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isFinishing) {
        event.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, isFinishing, handleSkip]);

  // Lock background scroll while the takeover owns the viewport.
  useEffect(() => {
    if (!show) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [show]);

  if (!show) return null;

  const slide = SLIDES[step];
  const SlideIcon = slide.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={slide.title}
      {...stylex.props(styles.overlay)}
    >
      {/* Brand header + Skip */}
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.brand)}>
          <img src={logoSvg} alt="" {...stylex.props(styles.brandLogo)} />
          <span {...stylex.props(styles.brandTitle)}>Project LunaClair</span>
        </div>
        <Button
          label="Skip"
          variant="ghost"
          icon={<X size={16} />}
          isIconOnly
          onClick={handleSkip}
          isDisabled={isFinishing}
        />
      </header>

      {/* Hero slide — keyed by step so each slide re-enters */}
      <div key={step} {...stylex.props(styles.hero)}>
        <div {...stylex.props(styles.iconBadge)}>
          <SlideIcon size={30} {...stylex.props(styles.icon)} aria-hidden="true" />
        </div>
        <h2 {...stylex.props(styles.title)}>{slide.title}</h2>
        <p {...stylex.props(styles.body)}>{slide.body}</p>
      </div>

      {/* Bottom action bar — dots + Back + full-width CTA */}
      <footer {...stylex.props(styles.footer)}>
        <div {...stylex.props(styles.dots)} role="tablist" aria-label="Onboarding steps">
          {SLIDES.map((s, index) => (
            <span
              key={s.title}
              role="tab"
              aria-selected={index === step}
              {...stylex.props(styles.dot, index === step && styles.dotActive)}
            />
          ))}
        </div>

        {step > 0 && (
          <Button
            label="Back"
            variant="ghost"
            icon={<ChevronLeft size={16} />}
            onClick={() => setStep((prev) => prev - 1)}
            isDisabled={isFinishing}
          >
            Back
          </Button>
        )}

        <div {...stylex.props(styles.ctaRow)}>
          {isLastStep ? (
            <Button
              label="Finish"
              variant="primary"
              width="100%"
              icon={isFinishing ? undefined : <Check size={16} />}
              onClick={() => void handleFinish()}
              isDisabled={isFinishing}
            >
              {isFinishing ? 'Setting up…' : 'Finish'}
            </Button>
          ) : (
            <Button
              label="Next"
              variant="primary"
              width="100%"
              icon={<ChevronRight size={16} />}
              onClick={() => setStep((prev) => prev + 1)}
            >
              Next
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

const fadeSlideUp = stylex.keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(12px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const styles = stylex.create({
  // Full-screen takeover above all app chrome (1000) but below toasts (9999).
  // Uses --color-background-body (the app page background) — NOT the legacy
  // undefined --color-background token.
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    backgroundColor: 'var(--color-background-body)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexShrink: 0,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 'clamp(20px, 4vw, 32px)',
    paddingRight: 'clamp(20px, 4vw, 32px)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 26,
    height: 26,
    objectFit: 'contain',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  hero: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    paddingRight: 24,
    textAlign: 'center',
    animationName: fadeSlideUp,
    animationDuration: '0.28s',
    animationTimingFunction: 'ease-out',
  },
  iconBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'var(--color-accent-muted)',
  },
  icon: {
    color: 'var(--color-accent)',
  },
  title: {
    margin: 0,
    maxWidth: 420,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: 'var(--color-text-primary)',
  },
  body: {
    margin: 0,
    maxWidth: 420,
    fontSize: 15,
    lineHeight: 1.65,
    color: 'var(--color-text-secondary)',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    flexShrink: 0,
    paddingTop: 20,
    paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
    paddingLeft: 24,
    paddingRight: 24,
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'var(--color-border)',
    transition: 'background-color 0.2s ease, width 0.2s ease',
  },
  dotActive: {
    width: 24,
    backgroundColor: 'var(--color-accent)',
  },
  ctaRow: {
    width: 'min(400px, 100%)',
  },
});
