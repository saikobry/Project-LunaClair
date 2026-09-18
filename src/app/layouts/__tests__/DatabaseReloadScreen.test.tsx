import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatabaseReloadScreen from '../DatabaseReloadScreen';
import type { DatabaseReloadReason } from '../../../infrastructure/database/schema/databaseLifecycle';

const CASES: Array<[DatabaseReloadReason, RegExp]> = [
  ['app-updated', /LunaClair was updated/],
  ['database-reset', /lost its local database/],
  ['upgrade-blocked', /Close your other LunaClair tabs/],
];

describe('DatabaseReloadScreen', () => {
  it.each(CASES)('names the cause for %s', (reason, title) => {
    render(<DatabaseReloadScreen reason={reason} onReload={vi.fn()} />);

    expect(screen.getByText(title)).toBeInTheDocument();
    // Every case offers the same single recovery.
    expect(screen.getByRole('button', { name: 'Reload LunaClair' })).toBeInTheDocument();
  });

  it('tells the user the library survives an upgrade, and offers no destructive action', () => {
    render(<DatabaseReloadScreen reason="app-updated" onReload={vi.fn()} />);

    expect(screen.getByText(/your library and study progress are safe/i)).toBeInTheDocument();
    // A version mismatch is never a data problem: there must be no reset/clear affordance to click.
    expect(screen.queryByRole('button', { name: /reset|clear/i })).toBeNull();
  });

  it('reloads when the action is used', () => {
    const onReload = vi.fn();
    render(<DatabaseReloadScreen reason="upgrade-blocked" onReload={onReload} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reload LunaClair' }));

    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
