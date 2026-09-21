import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileBottomDock } from '../MobileBottomDock';
import { ApplicationContext } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';

describe('test MobileBottomDock', () => {
  it('renders dock and prints buttons', () => {
    const qc = new QueryClient();
    const mockContext: any = {
      repositories: {
        collectionRepository: {
          getAll: () => Promise.resolve([]),
          getByCollectionId: () => Promise.resolve([]),
        },
      },
    };

    render(
      <QueryClientProvider client={qc}>
        <ApplicationContext.Provider value={mockContext}>
          <ToastProvider>
            <MobileBottomDock
              active="library"
              isFocusMode={false}
              onToggleFocusMode={() => {}}
              onNavigate={() => {}}
            />
          </ToastProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );

    const buttons = screen.getAllByRole('button');
    // 5 primary destinations + the collections popover trigger + Focus Mode.
    // Import is not a destination — it is reached from Home's quick actions.
    expect(buttons).toHaveLength(7);
    expect(buttons[0]).toHaveAttribute('title', 'Home');
    expect(buttons[1]).toHaveAttribute('title', 'Library — Collections & Materials');
    expect(buttons[2]).toHaveAttribute('title', 'Explore Content');
    expect(buttons[3]).toHaveAttribute('title', 'Collections');
    expect(buttons[4]).toHaveAttribute('title', 'Learning Insights & Analytics');
    expect(buttons[5]).toHaveAttribute('title', 'Settings');
    expect(buttons[6]).toHaveAttribute('title', 'Enter Focus Mode');
  });

  it('does not render an active material button in the dock', () => {
    const qc = new QueryClient();
    const mockContext: any = {
      repositories: {
        collectionRepository: {
          getAll: () => Promise.resolve([]),
          getByCollectionId: () => Promise.resolve([]),
        },
      },
    };

    render(
      <QueryClientProvider client={qc}>
        <ApplicationContext.Provider value={mockContext}>
          <ToastProvider>
            <MobileBottomDock
              active="none"
              isFocusMode={false}
              onToggleFocusMode={() => {}}
              onNavigate={() => {}}
              collectionId={null}
            />
          </ToastProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
  });
});
