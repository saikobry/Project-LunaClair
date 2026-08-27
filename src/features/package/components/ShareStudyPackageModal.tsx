import { useState, useCallback, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  X,
  Share2,
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
import { usePublishStudyPackage } from '../hooks/usePublishStudyPackage';
import type { ShareAccessType } from '../../../domain/sharing/sharing.types';

export interface ShareStudyPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialTitle: string;
}

type ExpirationOption = 'never' | '7d' | '30d';

const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 16,
    boxSizing: 'border-box',
  },
  dialog: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90vh',
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    borderRadius: 16,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    gap: 16,
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: 'var(--color-primary, #6366f1)',
    flexShrink: 0,
    marginTop: 2,
  },
  headerIconSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    color: 'var(--color-success, #10b981)',
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
    wordBreak: 'break-word',
  },
  headerDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
  },
  body: {
    padding: 24,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    flex: 1,
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
    borderColor: 'var(--color-primary, #6366f1)',
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
      borderColor: 'var(--color-primary, #6366f1)',
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
      borderColor: 'var(--color-primary, #6366f1)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
    },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '16px 24px',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
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
    backgroundColor: 'var(--color-primary, #6366f1)',
    color: '#ffffff',
    ':hover:not(:disabled)': {
      opacity: 0.9,
    },
  },
  btnSuccess: {
    backgroundColor: 'var(--color-success, #10b981)',
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
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
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
    backgroundColor: 'var(--color-background-muted, #f9fafb)',
    fontFamily: 'monospace',
    outlineStyle: 'none',
  },
  shortLinkBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: 8,
    backgroundColor: 'var(--color-background-muted, #f9fafb)',
    border: '1px solid var(--color-border)',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  shortLinkCode: {
    fontFamily: 'monospace',
    fontWeight: 600,
    color: 'var(--color-primary, #6366f1)',
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

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPublishing) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPublishing, handleClose]);

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
    <div
      {...stylex.props(styles.backdrop)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-package-modal-title"
    >
      <div {...stylex.props(styles.dialog)}>
        {/* Header */}
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.headerTitleGroup)}>
            <div
              {...stylex.props(
                styles.headerIconWrapper,
                publishResult && styles.headerIconSuccess,
              )}
            >
              {publishResult ? <CheckCircle2 size={22} /> : <Share2 size={22} />}
            </div>
            <div {...stylex.props(styles.headerContent)}>
              <h2 id="share-package-modal-title" {...stylex.props(styles.headerTitle)}>
                {publishResult ? 'Package Published!' : 'Share Study Package'}
              </h2>
              <p {...stylex.props(styles.headerDescription)}>
                {publishResult
                  ? `"${materialTitle}" is now published and accessible in the cloud.`
                  : `Publish an immutable snapshot of "${materialTitle}" to the cloud.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            {...stylex.props(styles.closeButton)}
            onClick={handleClose}
            aria-label="Close dialog"
            disabled={isPublishing}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div {...stylex.props(styles.body)}>
          {publishResult ? (
            <div {...stylex.props(styles.successContainer)}>
              <div {...stylex.props(styles.successMessageCard)}>
                <CheckCircle2 size={20} color="var(--color-success, #10b981)" />
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
                    onClick={handleCopy}
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
                  {publishResult.accessType === 'public' && <Globe size={12} />}
                  {publishResult.accessType === 'unlisted' && <Link2 size={12} />}
                  {publishResult.accessType === 'passcode' && <Lock size={12} />}
                  Access: {publishResult.accessType.toUpperCase()}
                </span>
                <span {...stylex.props(styles.metaPill)}>
                  <Clock size={12} />
                  Expires: {expiration === 'never' ? 'Never' : expiration === '7d' ? '7 Days' : '30 Days'}
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Access Type Selector */}
              <div {...stylex.props(styles.section)}>
                <span {...stylex.props(styles.sectionTitle)}>
                  <Globe size={14} /> Access Permission
                </span>
                <div {...stylex.props(styles.accessTypesGrid)} role="radiogroup" aria-label="Access Permission">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={accessType === 'public'}
                    {...stylex.props(
                      styles.accessTypeCard,
                      accessType === 'public' && styles.accessTypeCardActive,
                    )}
                    onClick={() => setAccessType('public')}
                    disabled={isPublishing}
                  >
                    <div {...stylex.props(styles.accessTypeHeader)}>
                      <Globe size={15} color="var(--color-primary, #6366f1)" />
                      <span>Public</span>
                    </div>
                    <p {...stylex.props(styles.accessTypeDescription)}>
                      Openly discoverable and importable by anyone.
                    </p>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={accessType === 'unlisted'}
                    {...stylex.props(
                      styles.accessTypeCard,
                      accessType === 'unlisted' && styles.accessTypeCardActive,
                    )}
                    onClick={() => setAccessType('unlisted')}
                    disabled={isPublishing}
                  >
                    <div {...stylex.props(styles.accessTypeHeader)}>
                      <Link2 size={15} color="var(--color-primary, #6366f1)" />
                      <span>Unlisted</span>
                    </div>
                    <p {...stylex.props(styles.accessTypeDescription)}>
                      Only accessible to people who have the direct link.
                    </p>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={accessType === 'passcode'}
                    {...stylex.props(
                      styles.accessTypeCard,
                      accessType === 'passcode' && styles.accessTypeCardActive,
                    )}
                    onClick={() => setAccessType('passcode')}
                    disabled={isPublishing}
                  >
                    <div {...stylex.props(styles.accessTypeHeader)}>
                      <Lock size={15} color="var(--color-primary, #6366f1)" />
                      <span>Passcode</span>
                    </div>
                    <p {...stylex.props(styles.accessTypeDescription)}>
                      Requires a secret passcode to access.
                    </p>
                  </button>
                </div>
              </div>

              {/* Passcode Input (when passcode option is selected) */}
              {accessType === 'passcode' && (
                <div {...stylex.props(styles.inputGroup)}>
                  <label htmlFor="share-passcode-input" {...stylex.props(styles.label)}>
                    <KeyRound size={14} /> Secret Passcode
                  </label>
                  <input
                    id="share-passcode-input"
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
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
                  onChange={(e) => setExpiration(e.target.value as ExpirationOption)}
                  disabled={isPublishing}
                  {...stylex.props(styles.select)}
                >
                  <option value="never">Never (Permanent)</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
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
      </div>
    </div>
  );
}
