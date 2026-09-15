import { useState, useCallback, type ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  Globe,
  Link2,
  Lock,
  KeyRound,
  Clock,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { usePublishStudyPackage } from '../hooks/usePublishStudyPackage';
import type { ShareAccessType, PublishShareResult } from '../../../domain/sharing/models/sharing.types';

export interface ShareStudyPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialTitle: string;
}

type ExpirationOption = 'never' | '7d' | '30d';

const styles = stylex.create({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  description: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  accessTypesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    '@media (max-width: 500px)': {
      gridTemplateColumns: '1fr',
    },
  },
  accessTypeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '12px 14px',
    backgroundColor: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    gap: 6,
    outline: 'none',
    ':hover:not(:disabled)': {
      backgroundColor: 'var(--color-background-muted)',
    },
  },
  accessTypeCardActive: {
    borderColor: 'var(--color-accent)',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  accessTypeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  accessTypeDescription: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.3,
    margin: 0,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  input: {
    padding: '9px 12px',
    fontSize: 13,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-surface)',
    outlineStyle: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: 'var(--color-accent)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
    },
  },
  select: {
    padding: '9px 12px',
    fontSize: 13,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-surface)',
    outlineStyle: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
    ':focus': {
      borderColor: 'var(--color-accent)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
    outline: 'none',
    fontFamily: 'inherit',
    ':disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
    },
  },
  btnSecondary: {
    backgroundColor: 'var(--color-background-muted)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
    ':hover:not(:disabled)': {
      backgroundColor: 'var(--color-border)',
    },
  },
  btnPrimary: {
    backgroundColor: 'var(--color-accent)',
    color: '#ffffff',
    ':hover:not(:disabled)': {
      opacity: 0.9,
    },
  },
  btnSuccess: {
    backgroundColor: 'var(--color-success)',
    color: '#ffffff',
  },
  // Success View Styles
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  successMessageCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 10,
    backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
    color: 'var(--color-text-primary)',
  },
  successMessageText: {
    fontSize: 13,
    lineHeight: 1.4,
    margin: 0,
    color: 'var(--color-text-secondary)',
  },
  linkBoxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  linkRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  linkInput: {
    flex: 1,
    padding: '9px 12px',
    fontSize: 13,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    backgroundColor: 'var(--color-background-muted)',
    fontFamily: 'monospace',
    outlineStyle: 'none',
  },
  shortLinkBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: 8,
    backgroundColor: 'var(--color-background-muted)',
    border: '1px solid var(--color-border)',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  shortLinkCode: {
    fontFamily: 'monospace',
    fontWeight: 600,
    color: 'var(--color-accent)',
  },
  metaPillsRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  metaPill: {
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-muted)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
});

function accessTypeIcon(accessType: ShareAccessType) {
  switch (accessType) {
    case 'public':
      return <Globe size={12} />;
    case 'unlisted':
      return <Link2 size={12} />;
    case 'passcode':
      return <Lock size={12} />;
  }
}

function expirationLabel(expiration: ExpirationOption): string {
  if (expiration === 'never') return 'Never';
  if (expiration === '7d') return '7 Days';
  return '30 Days';
}

function PublishedSharePanel({
  publishResult,
  fullShareUrl,
  shortShareUrl,
  copied,
  expiration,
  onCopy,
}: {
  publishResult: PublishShareResult;
  fullShareUrl: string;
  shortShareUrl: string;
  copied: boolean;
  expiration: ExpirationOption;
  onCopy: () => void;
}) {
  return (
    <div {...stylex.props(styles.successContainer)}>
      <div {...stylex.props(styles.successMessageCard)}>
        <CheckCircle2 size={20} color="var(--color-success)" />
        <p {...stylex.props(styles.successMessageText)}>
          Anyone with the link can view and import this study package into their LunaClair library.
        </p>
      </div>

      {/* Full Share Link Input + Copy Button */}
      <div {...stylex.props(styles.linkBoxGroup)}>
        <label htmlFor="full-share-link" {...stylex.props(styles.label)}>
          <Globe size={14} /> Full Share Link
        </label>
        <div {...stylex.props(styles.linkRow)}>
          <input
            id="full-share-link"
            type="text"
            readOnly
            value={fullShareUrl}
            {...stylex.props(styles.linkInput)}
          />
          <button
            type="button"
            {...stylex.props(
              styles.actionButton,
              copied ? styles.btnSuccess : styles.btnPrimary,
            )}
            onClick={onCopy}
            aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* Short Link Display */}
      <div {...stylex.props(styles.shortLinkBox)}>
        <span>Short Link:</span>
        <span {...stylex.props(styles.shortLinkCode)}>{shortShareUrl}</span>
      </div>

      {/* Share Info Badges */}
      <div {...stylex.props(styles.metaPillsRow)}>
        <span {...stylex.props(styles.metaPill)}>
          {accessTypeIcon(publishResult.accessType)}
          Access: {publishResult.accessType.toUpperCase()}
        </span>
        <span {...stylex.props(styles.metaPill)}>
          <Clock size={12} />
          Expires: {expirationLabel(expiration)}
        </span>
      </div>
    </div>
  );
}

function AccessTypeOption({
  icon,
  label,
  description,
  checked,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      {...stylex.props(
        styles.accessTypeCard,
        checked && styles.accessTypeCardActive,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div {...stylex.props(styles.accessTypeHeader)}>
        {icon}
        <span>{label}</span>
      </div>
      <p {...stylex.props(styles.accessTypeDescription)}>
        {description}
      </p>
    </button>
  );
}

interface ShareStudyPackageBodyProps {
  publishResult: PublishShareResult | null;
  accessType: ShareAccessType;
  passcode: string;
  expiration: ExpirationOption;
  copied: boolean;
  isPublishing: boolean;
  fullShareUrl: string;
  shortShareUrl: string;
  onAccessTypeChange: (type: ShareAccessType) => void;
  onPasscodeChange: (value: string) => void;
  onExpirationChange: (value: ExpirationOption) => void;
  onCopy: () => void;
}

function ShareStudyPackageBody({
  publishResult,
  accessType,
  passcode,
  expiration,
  copied,
  isPublishing,
  fullShareUrl,
  shortShareUrl,
  onAccessTypeChange,
  onPasscodeChange,
  onExpirationChange,
  onCopy,
}: ShareStudyPackageBodyProps) {
  if (publishResult) {
    return (
      <PublishedSharePanel
        publishResult={publishResult}
        fullShareUrl={fullShareUrl}
        shortShareUrl={shortShareUrl}
        copied={copied}
        expiration={expiration}
        onCopy={onCopy}
      />
    );
  }

  const isPasscodeSelected = accessType === 'passcode';

  return (
    <>
      {/* Access Type Selector */}
      <div {...stylex.props(styles.section)}>
        <span {...stylex.props(styles.sectionTitle)}>
          <Globe size={14} /> Access Permission
        </span>
        <div {...stylex.props(styles.accessTypesGrid)} role="radiogroup" aria-label="Access Permission">
          <AccessTypeOption
            icon={<Globe size={15} color="var(--color-accent)" />}
            label="Public"
            description="Openly discoverable and importable by anyone."
            checked={accessType === 'public'}
            disabled={isPublishing}
            onClick={() => onAccessTypeChange('public')}
          />
          <AccessTypeOption
            icon={<Link2 size={15} color="var(--color-accent)" />}
            label="Unlisted"
            description="Only accessible to people who have the direct link."
            checked={accessType === 'unlisted'}
            disabled={isPublishing}
            onClick={() => onAccessTypeChange('unlisted')}
          />
          <AccessTypeOption
            icon={<Lock size={15} color="var(--color-accent)" />}
            label="Passcode"
            description="Requires a secret passcode to access."
            checked={isPasscodeSelected}
            disabled={isPublishing}
            onClick={() => onAccessTypeChange('passcode')}
          />
        </div>
      </div>

      {/* Passcode Input (when passcode option is selected) */}
      {isPasscodeSelected && (
        <div {...stylex.props(styles.inputGroup)}>
          <label htmlFor="share-passcode-input" {...stylex.props(styles.label)}>
            <KeyRound size={14} /> Secret Passcode
          </label>
          <input
            id="share-passcode-input"
            type="text"
            value={passcode}
            onChange={(e) => onPasscodeChange(e.target.value)}
            placeholder="Enter access passcode"
            disabled={isPublishing}
            {...stylex.props(styles.input)}
          />
        </div>
      )}

      {/* Expiration Selector */}
      <div {...stylex.props(styles.inputGroup)}>
        <label htmlFor="share-expiration-select" {...stylex.props(styles.label)}>
          <Clock size={14} /> Link Expiration
        </label>
        <select
          id="share-expiration-select"
          value={expiration}
          onChange={(e) => onExpirationChange(e.target.value as ExpirationOption)}
          disabled={isPublishing}
          {...stylex.props(styles.select)}
        >
          <option value="never">Never (Permanent)</option>
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
        </select>
      </div>
    </>
  );
}

export function ShareStudyPackageModal({
  isOpen,
  onClose,
  materialId,
  materialTitle,
}: ShareStudyPackageModalProps) {
  const [accessType, setAccessType] = useState<ShareAccessType>('public');
  const [passcode, setPasscode] = useState('');
  const [expiration, setExpiration] = useState<ExpirationOption>('never');
  const [copied, setCopied] = useState(false);

  const { publish, isPublishing, publishResult, reset } = usePublishStudyPackage();

  // Reset form and publish state when closed or opened
  const handleClose = useCallback(() => {
    if (isPublishing) return;
    setAccessType('public');
    setPasscode('');
    setExpiration('never');
    setCopied(false);
    reset();
    onClose();
  }, [isPublishing, reset, onClose]);

  if (!isOpen) {
    return null;
  }

  const handlePublish = async () => {
    let expiresAt: string | undefined;
    if (expiration === '7d') {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expiration === '30d') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    await publish(materialId, {
      accessType,
      passcode: accessType === 'passcode' ? passcode.trim() : undefined,
      expiresAt,
    });
  };

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://lunaclair.app';

  const fullShareUrl = publishResult
    ? `${origin}/share/${publishResult.id}`
    : '';

  const shortShareUrl = publishResult
    ? `${origin}/s/${publishResult.id}`
    : '';

  const handleCopy = async () => {
    if (!fullShareUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullShareUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const isPasscodeInvalid = accessType === 'passcode' && !passcode.trim();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={publishResult ? 'Package Published!' : 'Share Study Package'}
      width={520}
      footer={
        <div {...stylex.props(styles.footer)}>
          {publishResult ? (
            <button
              type="button"
              {...stylex.props(styles.actionButton, styles.btnPrimary)}
              onClick={handleClose}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                {...stylex.props(styles.actionButton, styles.btnSecondary)}
                onClick={handleClose}
                disabled={isPublishing}
              >
                Cancel
              </button>
              <button
                type="button"
                {...stylex.props(styles.actionButton, styles.btnPrimary)}
                onClick={handlePublish}
                disabled={isPublishing || isPasscodeInvalid}
              >
                {isPublishing ? (
                  <>
                    <Loader2 size={15} className="lucide-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Globe size={15} />
                    <span>Publish to Cloud</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      }
    >
      <div {...stylex.props(styles.body)}>
        <p {...stylex.props(styles.description)}>
          {publishResult
            ? `"${materialTitle}" is now published and accessible in the cloud.`
            : `Publish an immutable snapshot of "${materialTitle}" to the cloud.`}
        </p>

        <ShareStudyPackageBody
          publishResult={publishResult}
          accessType={accessType}
          passcode={passcode}
          expiration={expiration}
          copied={copied}
          isPublishing={isPublishing}
          fullShareUrl={fullShareUrl}
          shortShareUrl={shortShareUrl}
          onAccessTypeChange={setAccessType}
          onPasscodeChange={setPasscode}
          onExpirationChange={setExpiration}
          onCopy={handleCopy}
        />
      </div>
    </Dialog>
  );
}
