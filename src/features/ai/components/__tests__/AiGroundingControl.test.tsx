import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiGroundingControl } from '../AiGroundingControl';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const contextValue = {
    repositories: {},
    useCases: { ai: {} },
  } as unknown as ApplicationContextValue;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={contextValue}>{children}</ApplicationContext.Provider>
    </QueryClientProvider>
  );

  return { wrapper };
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

  it('describes the grounded mode so the choice explains itself', async () => {
    const { wrapper } = createWrapper();

    render(
      <AiGroundingControl
        materialId="mat-1"
        grounding="whole"
        onSetGrounding={vi.fn()}
      />,
      { wrapper },
    );

    expect(
      await screen.findByText(/text is attached to each new message/i),
    ).toBeInTheDocument();
  });

  it('describes the ungrounded mode in its own words', async () => {
    const { wrapper } = createWrapper();

    render(
      <AiGroundingControl
        materialId="mat-1"
        grounding="none"
        onSetGrounding={vi.fn()}
      />,
      { wrapper },
    );

    expect(
      await screen.findByText(/answers come from general knowledge/i),
    ).toBeInTheDocument();
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
