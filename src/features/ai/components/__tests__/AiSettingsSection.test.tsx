import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { AiSettingsSection } from '../AiSettingsSection';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import { createAiChatHarness } from '../../../../test/mocks/aiChatHarness';

describe('AiSettingsSection', () => {
  let db: LunaClairDatabase;

  beforeEach(async () => {
    localStorage.clear();
    db = new LunaClairDatabase();
    await db.open();
  });

  afterEach(async () => {
    localStorage.clear();
    await db.delete();
    db.close();
  });

  function renderSection() {
    const harness = createAiChatHarness(db, new MockAiAdapter({ tokens: ['Answer.'] }));
    render(<AiSettingsSection />, { wrapper: harness.wrapper });
    return harness;
  }

  it('renders every assistant preference with its current value', async () => {
    renderSection();

    expect(screen.getByRole('heading', { name: 'AI Study Assistant' })).toBeInTheDocument();
    // Preferred model offers the catalog choice.
    expect(
      screen.getByRole('radiogroup', { name: /AI model for the next message/i }),
    ).toBeInTheDocument();
    // Material inclusion defaults to the whole material.
    expect(screen.getByRole('radio', { name: 'Whole material' })).toBeChecked();
    // Selection replies default to the newest conversation.
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Latest chat' })).toBeChecked();
    });
  });

  it('persists the selection thread mode', async () => {
    const harness = renderSection();

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Latest chat' })).toBeChecked();
    });

    fireEvent.click(screen.getByRole('radio', { name: 'New chat' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'New chat' })).toBeChecked();
    });
    expect(
      await harness.contextValue.repositories.preferences.getAiSelectionThreadMode(),
    ).toBe('new');

    fireEvent.click(screen.getByRole('radio', { name: 'Latest chat' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Latest chat' })).toBeChecked();
    });
  });

  it('persists the material inclusion default', async () => {
    const harness = renderSection();

    fireEvent.click(screen.getByRole('radio', { name: 'No material' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'No material' })).toBeChecked();
    });
    expect(await harness.contextValue.repositories.preferences.getAiGroundingDefault()).toBe(
      'none',
    );
  });

  it('remembers the preferred model on this device', async () => {
    const harness = renderSection();

    fireEvent.click(screen.getByRole('radio', { name: 'MAX' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'MAX' })).toBeChecked();
    });
    expect(await harness.contextValue.repositories.preferences.getPreferredModelId()).toBe(
      'ukisai-swift-max',
    );
  });
});
