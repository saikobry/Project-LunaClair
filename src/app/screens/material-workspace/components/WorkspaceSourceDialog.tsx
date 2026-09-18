import * as stylex from '@stylexjs/stylex';
import type { StoredAsset } from '../../../../domain/assets/repositories/AssetRepository';
import { Dialog } from '../../../../shared/ui/Dialog/Dialog';

import { formatBytes } from '../utils/formatBytes';

const styles = stylex.create({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  meta: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  previewFrame: {
    width: '100%',
    minHeight: 320,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 12,
    backgroundColor: 'var(--color-background-muted)',
  },
  previewImage: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
  },
  note: {
    fontSize: 12.5,
    lineHeight: 1.55,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  footer: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textDecorationLine: 'none',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
  },
  actionPrimary: {
    backgroundColor: 'var(--color-accent)',
    borderColor: 'var(--color-accent)',
    color: '#fff',
  },
  closeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
  },
});

export interface WorkspaceSourceDialogProps {
  /** Asset to preview. The parent mounts this dialog only while one is selected. */
  asset: StoredAsset;
  /** Revocable object URL for the asset blob (owned by the caller's asset map). */
  objectUrl: string;
  onClose: () => void;
}

/**
 * Preserved-file viewer: inline preview plus download. Images render
 * directly; PDFs ride the browser's native viewer through an `<iframe>` on
 * the blob URL — no new packages. iOS Safari does not render PDFs inside
 * iframes reliably, so the preview is always paired with open/download
 * links carrying the same bytes to the OS viewer.
 */
export function WorkspaceSourceDialog({ asset, objectUrl, onClose }: WorkspaceSourceDialogProps) {
  const isImage = asset.mimeType.startsWith('image/');
  const isPdf = asset.mimeType === 'application/pdf';

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={asset.filename || 'Source file'}
      width={560}
      footer={
        <div {...stylex.props(styles.footer)}>
          <a
            href={objectUrl}
            download={asset.filename || true}
            {...stylex.props(styles.actionLink, styles.actionPrimary)}
          >
            Download original
          </a>
          <a
            href={objectUrl}
            target="_blank"
            rel="noreferrer"
            {...stylex.props(styles.actionLink)}
          >
            Open in new tab
          </a>
          <button type="button" {...stylex.props(styles.closeButton)} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div {...stylex.props(styles.body)}>
        <p {...stylex.props(styles.meta)}>
          {formatBytes(asset.blob.size)} · {asset.mimeType || 'unknown type'} · preserved{' '}
          {new Date(asset.importedAt).toLocaleDateString()}
        </p>
        {isImage && (
          <img src={objectUrl} alt={asset.filename} {...stylex.props(styles.previewImage)} />
        )}
        {isPdf && (
          <iframe
            src={objectUrl}
            title={asset.filename}
            // Scripts stay blocked; same-origin is required for the blob:
            // URL and the browser's PDF plugin. A fully bare sandbox breaks
            // PDF rendering, while allow-scripts would re-enable embedded
            // PDF JavaScript — this is the narrowest working combination.
            sandbox="allow-same-origin"
            {...stylex.props(styles.previewFrame)}
          />
        )}
        {!isImage && !isPdf && (
          <p {...stylex.props(styles.note)}>
            No inline preview for this file type — use Download or Open in new tab.
          </p>
        )}
        {isPdf && (
          <p {...stylex.props(styles.note)}>
            If the preview above is blank (notably on iOS), use Open in new tab
            for the system viewer — same file, no re-download from anywhere.
          </p>
        )}
      </div>
    </Dialog>
  );
}
