import { useCallback, useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Sparkles, X } from 'lucide-react';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { Button } from '../../shared/ui/Button/Button';
import logoSvg from '../../assets/logo.svg';

/**
 * First-run onboarding tutorial (app-shell chrome).
 *
 * A FULL-SCREEN takeover rendered as a native `<dialog>` opened with
 * `showModal()` — the entire viewport becomes the onboarding screen (brand
 * header with Skip, centered hero slide, bottom action bar with progress dots
 * + full-width CTA), and the modal gives focus trapping, Escape-to-close, and
 * focus restoration for free. One-time and skippable, persisted via
 * `STORAGE_KEYS.settings.onboardingDone`.
 *
 * The tutorial is bundled app chrome — it never depends on the network.
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
    body: 'Explore shared study packages and clone what you want to study. Materials live in your library, organized into collections.',
  },
  {
    icon: GraduationCap,
    title: 'Collections & quizzes',
    body: 'Organize materials into collections and test yourself with quizzes and flashcards.',
  },
  {
    icon: CheckCircle2,
    title: "You're all set",
    body: 'Finish up and start studying.',
  },
] as const;

interface OnboardingTutorialProps {
  /** Hide while immersive routes (quiz session/canvas) own the screen. */
  suppressed?: boolean;
}

export function OnboardingTutorial({ suppressed = false }: OnboardingTutorialProps) {
  // Shown until finished OR skipped — one-time per browser.
  const [done, setDone] = useState(
    () => localStorage.getItem(STORAGE_KEYS.settings.onboardingDone) === '1',
  );
  const [step, setStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const show = !suppressed && !done;
  const isLastStep = step === SLIDES.length - 1;

  const dialogRef = useRef<HTMLDialogElement>(null);

  const markDone = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.settings.onboardingDone, '1');
    setDone(true);
  }, []);

  const handleSkip = useCallback(() => {
    markDone();
  }, [markDone]);

  const handleFinish = useCallback(async () => {
    setIsFinishing(true);
    markDone();
  }, [markDone]);

  // Open as a modal when shown — native <dialog> provides focus trapping,
  // Escape (via the `cancel` event), and the backdrop. Escape is handled in
  // onCancel below (Skip semantics), so no manual keydown listener needed.
  useEffect(() => {
    if (show && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [show]);

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
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        // Escape inside a modal fires `cancel` — treat it as Skip (same as
        // the Skip button), never a plain close. Prevent default so the
        // dialog cannot close during the finishing state.
        event.preventDefault();
        if (!isFinishing) handleSkip();
      }}
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
    </dialog>
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
  // Native <dialog> full-viewport takeover: reset the UA dialog styles
  // (centering margins, max-width/height, padding, border) so the element
  // fills the screen. `::backdrop` matches the page background.
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    margin: 0,
    width: '100vw',
    height: '100svh',
    maxWidth: 'none',
    maxHeight: 'none',
    padding: 0,
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    backgroundColor: 'var(--color-background-body)',
    '::backdrop': {
      backgroundColor: 'var(--color-background-body)',
    },
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
