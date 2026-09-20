export const STORAGE_KEYS = {
  library: {
    materials: 'lunaclair.library.materials',
  },
  reader: {
    highlights: 'lunaclair.reader.highlights',
    drawings: 'lunaclair.reader.drawings',
    toolbarPosition: 'lunaclair.reader.toolbar_pos',
  },
  settings: {
    theme: 'lunaclair.settings.theme',
    focusMode: 'lunaclair.focus_mode',
    visitCount: 'lunaclair.settings.visit_count',
    installDismissed: 'lunaclair.settings.install_prompt_dismissed',
    onboardingDone: 'lunaclair.settings.onboarding_done',
  },
  ai: {
    /** Preferred AI model id — a per-request choice, device-local, never a conversation property. */
    modelId: 'lunaclair.ai.model_id',
    /**
     * Absolute epoch-ms deadline of an active rate-limit cooldown.
     *
     * The wait belongs to the provider's window, not to this tab: a reload must not re-arm a request
     * the provider is still refusing.
     */
    rateLimitUntil: 'lunaclair.ai.rate_limit_until',
  },
  sync: {
    deviceId: 'lunaclair.device_id',
    sessionCredentials: 'lunaclair.session_credentials',
  },
  session: {
    visitMarked: 'lunaclair.session.visit_marked',
  },
} as const;
