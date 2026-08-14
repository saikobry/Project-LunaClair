export const STORAGE_KEYS = {
  library: {
    materials: 'lunaclair.library.materials',
  },
  reader: {
    highlights: 'lunaclair.reader.highlights',
    drawings: 'lunaclair.reader.drawings',
  },
  settings: {
    theme: 'lunaclair.settings.theme',
    focusMode: 'lunaclair.focus_mode',
    visitCount: 'lunaclair.settings.visit_count',
    installDismissed: 'lunaclair.settings.install_prompt_dismissed',
    onboardingDone: 'lunaclair.settings.onboarding_done',
  },
  session: {
    visitMarked: 'lunaclair.session.visit_marked',
  },
} as const;
