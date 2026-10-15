import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsScreen } from '../SettingsScreen';
import { ApplicationContext } from '../../../providers/ApplicationContext';

// Mock feature sections to test composition
vi.mock('../../../../features/sync/components/SyncSettingsSection', () => ({
  SyncSettingsSection: () => <div data-testid="mock-sync-settings">Sync Settings Section</div>,
}));

vi.mock('../../../../features/ai/components/AiSettingsSection', () => ({
  AiSettingsSection: () => <div data-testid="mock-ai-settings">AI Settings Section</div>,
}));

describe('SettingsScreen', () => {
  it('renders settings title, description, and composes sync and ai sections', () => {
    render(
      <ApplicationContext.Provider value={{} as any}>
        <SettingsScreen />
      </ApplicationContext.Provider>
    );

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-sync-settings')).toBeInTheDocument();
    expect(screen.getByTestId('mock-ai-settings')).toBeInTheDocument();
  });
});
