import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareStudyPackageModal } from '../ShareStudyPackageModal';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { PublishShareResult } from '../../../../domain/sharing/models/sharing.types';

const showToastMock = vi.fn();
vi.mock('../../../../app/providers/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ShareStudyPackageModal', () => {
  const mockPublishResult: PublishShareResult = {
    id: 'share_xyz789',
    format: 'lcpack',
    schemaVersion: 1,
    title: 'General Chemistry 101',
    description: 'Stoichiometry and Atomic Structure',
    accessType: 'public',
    shareUrl: '/share/share_xyz789',
    createdAt: '2026-08-28T00:00:00.000Z',
  };

  let mockPublishExecute: ReturnType<typeof vi.fn>;
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishExecute = vi.fn().mockResolvedValue(mockPublishResult);

    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  function renderModal(props: Partial<Parameters<typeof ShareStudyPackageModal>[0]> = {}) {
    const onClose = vi.fn();

    const mockContextValue = {
      useCases: {
        sharing: {
          publishStudyPackage: {
            execute: mockPublishExecute,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    const utils = render(
      <ApplicationContext.Provider value={mockContextValue}>
        <ShareStudyPackageModal
          isOpen={true}
          onClose={onClose}
          materialId="mat-chem-1"
          materialTitle="General Chemistry 101"
          {...props}
        />
      </ApplicationContext.Provider>
    );

    return {
      ...utils,
      onClose,
    };
  }

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal dialog with access type choices and expiration selector', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Share Study Package')).toBeInTheDocument();
    expect(screen.getByText(/General Chemistry 101/)).toBeInTheDocument();

    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Unlisted')).toBeInTheDocument();
    expect(screen.getByText('Passcode')).toBeInTheDocument();

    expect(screen.getByLabelText(/Link Expiration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish to Cloud/i })).toBeEnabled();
  });

  it('shows passcode input when Passcode access type is selected and disables publish if empty', async () => {
    renderModal();

    const passcodeRadio = screen.getByRole('radio', { name: /Passcode/i });
    fireEvent.click(passcodeRadio);

    const passcodeInput = screen.getByPlaceholderText('Enter access passcode');
    expect(passcodeInput).toBeInTheDocument();

    const publishButton = screen.getByRole('button', { name: /Publish to Cloud/i });
    expect(publishButton).toBeDisabled();

    fireEvent.change(passcodeInput, { target: { value: 'mypassword' } });
    expect(publishButton).toBeEnabled();
  });

  it('publishes public share by default and transitions to success view', async () => {
    renderModal();

    const publishButton = screen.getByRole('button', { name: /Publish to Cloud/i });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mockPublishExecute).toHaveBeenCalledWith({
        materialId: 'mat-chem-1',
        accessType: 'public',
        passcode: undefined,
        expiresAt: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Package Published!')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue(new RegExp('/share/share_xyz789'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp('/s/share_xyz789'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Done/i })).toBeInTheDocument();
  });

  it('publishes with expiration and passcode options', async () => {
    renderModal();

    // Select passcode
    const passcodeRadio = screen.getByRole('radio', { name: /Passcode/i });
    fireEvent.click(passcodeRadio);
    const passcodeInput = screen.getByPlaceholderText('Enter access passcode');
    fireEvent.change(passcodeInput, { target: { value: 'chemSecret' } });

    // Select expiration
    const expirationSelect = screen.getByLabelText(/Link Expiration/i);
    fireEvent.change(expirationSelect, { target: { value: '7d' } });

    const publishButton = screen.getByRole('button', { name: /Publish to Cloud/i });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mockPublishExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          materialId: 'mat-chem-1',
          accessType: 'passcode',
          passcode: 'chemSecret',
          expiresAt: expect.any(String),
        })
      );
    });
  });

  it('copies share link to clipboard on Copy Link click and shows copied state', async () => {
    renderModal();

    const publishButton = screen.getByRole('button', { name: /Publish to Cloud/i });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy Link/i })).toBeInTheDocument();
    });

    const copyButton = screen.getByRole('button', { name: /Copy Link/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/share/share_xyz789'));
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('closes modal when Cancel, Close X, or Done button is clicked', async () => {
    const { onClose, unmount } = renderModal();

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeIconButton = screen.getByLabelText('Close');
    fireEvent.click(closeIconButton);
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();

    // In success state
    const { onClose: onCloseSuccess } = renderModal();
    const publishButton = screen.getByRole('button', { name: /Publish to Cloud/i });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    const doneButton = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(doneButton);
    expect(onCloseSuccess).toHaveBeenCalledTimes(1);
  });
});
