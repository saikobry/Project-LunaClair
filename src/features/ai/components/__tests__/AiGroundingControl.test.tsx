import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiGroundingControl } from '../AiGroundingControl';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { InMemoryPreferencesRepository } from '../../../../test/mocks/inMemoryPreferencesRepository';
import { SetGroundingDefaultUseCase } from '../../../../application/use-cases/ai/SetGroundingDefaultUseCase';

function createWrapper(prefRepo = new InMemoryPreferencesRepository('whole')) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const setGroundingDefault = new SetGroundingDefaultUseCase(prefRepo);
  const contextValue = {
    repositories: { preferences: prefRepo },
    useCases: { ai: { setGroundingDefault } },
  } as unknown as ApplicationContextValue;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={contextValue}>{children}</ApplicationContext.Provider>
    </QueryClientProvider>
  );

  return { wrapper, prefRepo };
}

describe('AiGroundingControl', () => {
  it('does not render when materialId is undefined (global chat)', () => {
    const { wrapper } = createWrapper();
    const onSetGrounding = vi.fn();
    const { container } = render(
      <AiGroundingControl
        materialId={undefined}
        grounding="none"
        onSetGrounding={onSetGrounding}
      />,
      { wrapper },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Whole material and No material choices when materialId is present', async () => {
    const { wrapper } = createWrapper();
    const onSetGrounding = vi.fn();

    render(
      <AiGroundingControl
        materialId="mat-1"
        grounding="whole"
        onSetGrounding={onSetGrounding}
      />,
      { wrapper },
    );

    expect(await screen.findByRole('radiogroup', { name: /Material context for this conversation/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Whole material/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /No material/i })).toBeInTheDocument();
  });

  it('shows "(Default for new chats)" when grounding matches the default preference', async () => {
    const { wrapper } = createWrapper(new InMemoryPreferencesRepository('whole'));
    const onSetGrounding = vi.fn();

    render(
      <AiGroundingControl
        materialId="mat-1"
        grounding="whole"
        onSetGrounding={onSetGrounding}
      />,
      { wrapper },
    );

    expect(await screen.findByText('(Default for new chats)')).toBeInTheDocument();
  });

  it('shows "Set as default for new chats" button when grounding differs from default and updates preference on click', async () => {
    const prefRepo = new InMemoryPreferencesRepository('whole');
    const { wrapper } = createWrapper(prefRepo);
    const onSetGrounding = vi.fn();

    render(
      <AiGroundingControl
        materialId="mat-1"
        grounding="none"
        onSetGrounding={onSetGrounding}
      />,
      { wrapper },
    );

    const btn = await screen.findByRole('button', { name: /Save no material as default/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);

    await waitFor(async () => {
      expect(await prefRepo.getAiGroundingDefault()).toBe('none');
    });

    expect(await screen.findByText('(Default for new chats)')).toBeInTheDocument();
  });

  it('invokes onSetGrounding when clicking an option', async () => {
    const { wrapper } = createWrapper();
    const onSetGrounding = vi.fn();

    render(
      <AiGroundingControl
        materialId="mat-1"
        grounding="whole"
        onSetGrounding={onSetGrounding}
      />,
      { wrapper },
    );

    const noMaterialRadio = await screen.findByRole('radio', { name: /No material/i });
    fireEvent.click(noMaterialRadio);

    expect(onSetGrounding).toHaveBeenCalledWith('none');
  });
});
