import * as stylex from '@stylexjs/stylex';
import { FileText } from 'lucide-react';
import type { StoredAsset } from '../../../../domain/assets/repositories/AssetRepository';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { Chip } from '../../../../shared/ui/Chip/Chip';
import { useStudyPackageSize, SHARE_PACKAGE_SIZE_LIMIT_BYTES } from '../../../../features/package/hooks/useStudyPackageSize';
import { useWorkspaceAssets } from '../hooks/useWorkspaceAssets';
import { formatBytes } from '../utils/formatBytes';

const styles = stylex.create({
  meterCard: {
    backgroundColor: 'var(--color-background-surface)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  meterTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
  },
  meterValue: {
    color: 'var(--color-accent)',
  },
  meterTrack: {
    height: 8,
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    backgroundColor: 'var(--color-accent)',
    borderRadius: 999,
  },
  meterSub: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'var(--color-text-secondary)',
    margin: '0 0 8px',
  },
  fileCard: {
    backgroundColor: 'var(--color-background-surface)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  fileHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fileName: {
    fontSize: 13.5,
    fontWeight: 600,
    margin: '0 0 2px',
    overflowWrap: 'anywhere',
  },
  fileMeta: {
    fontSize: 11.5,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  badgeRow: {
    display: 'flex',
    gap: 6,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  actionRow: {
    display: 'flex',
    gap: 6,
    marginTop: 10,
  },
  actionLink: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
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
  previewButton: {
    flex: 1,
    padding: '6px 12px',
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
  footnote: {
    fontSize: 12.5,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.55,
    margin: '4px 0 0',
  },
});

export interface WorkspaceAttachmentsProps {
  materialId: string;
  /** Current document markdown — resolves which figures the text references. */
  documentContent?: string;
  /** Object URLs for the material's assets, keyed by asset id (screen-owned). */
  assetUrls?: Map<string, string>;
  onPreviewFile: (asset: StoredAsset) => void;
}

/**
 * Attachments tab: every locally stored file for this material — the
 * preserved import original plus any package figures — with preview and
 * download. Read-only by design: individual files are never deleted here
 * (per-asset deletion has no repository contract; removal stays the atomic
 * material cascade), so a figure the document references cannot be orphaned
 * by a stray click.
 */
export function WorkspaceAttachments({
  materialId,
  documentContent = '',
  assetUrls,
  onPreviewFile,
}: WorkspaceAttachmentsProps) {
  const { assets, isLoading: isLoadingAssets } = useWorkspaceAssets(materialId);
  const { sizeBytes, isLoading: isLoadingSize } = useStudyPackageSize(materialId);

  if (isLoadingAssets) {
    return <div>Loading stored files…</div>;
  }

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={28} />}
        title="No stored files"
        description="This material has no preserved original or figures yet. Files arrive via PDF/image import or study-package cloning."
        headingLevel="h2"
      />
    );
  }

  const original = assets.find((asset) => asset.assetId === asset.materialId);
  const figures = assets.filter((asset) => asset.assetId !== asset.materialId);
  const percent = sizeBytes === undefined
    ? 0
    : Math.min(100, Math.round((sizeBytes / SHARE_PACKAGE_SIZE_LIMIT_BYTES) * 100));

  const renderFileActions = (asset: StoredAsset) => {
    const url = assetUrls?.get(asset.assetId);
    return (
      <div {...stylex.props(styles.actionRow)}>
        <button
          type="button"
          {...stylex.props(styles.previewButton)}
          onClick={() => onPreviewFile(asset)}
          disabled={!url}
        >
          Preview
        </button>
        {url ? (
          <a href={url} download={asset.filename || true} {...stylex.props(styles.actionLink)}>
            Download
          </a>
        ) : (
          <span {...stylex.props(styles.actionLink)}>Download</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <div {...stylex.props(styles.meterCard)}>
        <div {...stylex.props(styles.meterTop)}>
          <span>Share budget</span>
          <span {...stylex.props(styles.meterValue)}>
            {isLoadingSize || sizeBytes === undefined ? 'Measuring…' : `${formatBytes(sizeBytes)} / 5.0 MiB`}
          </span>
        </div>
        <div {...stylex.props(styles.meterTrack)}>
          <div {...stylex.props(styles.meterFill)} style={{ width: `${percent}%` }} />
        </div>
        <div {...stylex.props(styles.meterSub)}>
          <span>{percent}% of the share payload guard</span>
          <span>{assets.length} stored {assets.length === 1 ? 'file' : 'files'}</span>
        </div>
      </div>

      {original && (
        <>
          <p {...stylex.props(styles.sectionLabel)}>Preserved original</p>
          <div {...stylex.props(styles.fileCard)}>
            <div {...stylex.props(styles.fileHead)}>
              <div {...stylex.props(styles.fileIcon)}>
                <FileText size={16} aria-hidden="true" />
              </div>
              <div>
                <p {...stylex.props(styles.fileName)}>{original.filename}</p>
                <p {...stylex.props(styles.fileMeta)}>
                  {formatBytes(original.blob.size)} · {original.mimeType || 'unknown type'} · preserved{' '}
                  {new Date(original.importedAt).toLocaleDateString()}
                </p>
              </div>
              <div {...stylex.props(styles.badgeRow)}>
                <Chip variant="accent">original</Chip>
              </div>
            </div>
            {renderFileActions(original)}
          </div>
        </>
      )}

      {figures.length > 0 && (
        <>
          <p {...stylex.props(styles.sectionLabel)}>Stored figures</p>
          {figures.map((asset) => {
            const isReferenced = documentContent.includes(`lc-asset://${asset.assetId}`);
            return (
              <div key={asset.assetId} {...stylex.props(styles.fileCard)}>
                <div {...stylex.props(styles.fileHead)}>
                  <div {...stylex.props(styles.fileIcon)}>
                    <FileText size={16} aria-hidden="true" />
                  </div>
                  <div>
                    <p {...stylex.props(styles.fileName)}>{asset.filename}</p>
                    <p {...stylex.props(styles.fileMeta)}>
                      {formatBytes(asset.blob.size)} · {asset.mimeType || 'unknown type'}
                    </p>
                  </div>
                  <div {...stylex.props(styles.badgeRow)}>
                    <Chip variant="neutral">figure</Chip>
                    {isReferenced && <Chip variant="accent">referenced</Chip>}
                  </div>
                </div>
                {renderFileActions(asset)}
              </div>
            );
          })}
        </>
      )}

      <p {...stylex.props(styles.footnote)}>
        Files are removed only with the whole material (Remove from Library) —
        a figure the document references can never be deleted out from under it here.
      </p>
    </div>
  );
}
