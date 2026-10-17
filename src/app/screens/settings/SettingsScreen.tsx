import * as stylex from '@stylexjs/stylex';
import { Page } from '../../../shared/ui/Page/Page';
import { SyncSettingsSection } from '../../../features/sync/components/SyncSettingsSection';
import { VaultStorageSection } from '../../../features/sync/components/VaultStorageSection';
import { AiSettingsSection } from '../../../features/ai/components/AiSettingsSection';

const styles = stylex.create({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    width: '100%',
  },
});

/**
 * Settings route (`/settings`) — device-local preferences, grouped by section.
 *
 * A composer, not an owner: each section is owned by its feature (Sync owns
 * cloud sync and vault storage settings, AI owns the assistant section), and this
 * screen only stacks them. New preference areas arrive as new sections, never as
 * logic in this file. The back destination arrives as `onBack` (the shell's `goBack`:
 * last in-app route, Home fallback); the screen only forwards it to `Page`,
 * which owns the button chrome.
 */
export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Page
      title="Settings"
      description="Preferences for this device. They never sync and never leave this browser."
      onBack={onBack}
    >
      <div {...stylex.props(styles.content)}>
        <SyncSettingsSection />
        <VaultStorageSection />
        <AiSettingsSection />
      </div>
    </Page>
  );
}

export default SettingsScreen;
