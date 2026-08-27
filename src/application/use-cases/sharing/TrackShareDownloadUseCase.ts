/**
 * Application use case to record download metrics on a published share.
 */
import type { ShareTransport } from '../../../domain/sharing/sharing.types';

export class TrackShareDownloadUseCase {
  private readonly shareTransport: ShareTransport;

  constructor(shareTransport: ShareTransport) {
    this.shareTransport = shareTransport;
  }

  async execute(shareId: string, signal?: AbortSignal): Promise<{ success: boolean; downloadCount: number }> {
    return this.shareTransport.trackDownload(shareId, signal);
  }
}
