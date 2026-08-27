/**
 * Application use case to record download metrics on a published share.
 */
import type { ShareTransport } from '../../../domain/sharing/sharing.types';

export interface TrackShareDownloadInput {
  shareId: string;
}

export class TrackShareDownloadUseCase {
  private readonly shareTransport: ShareTransport;

  constructor(shareTransport: ShareTransport) {
    this.shareTransport = shareTransport;
  }

  async execute(input: string | TrackShareDownloadInput, signal?: AbortSignal): Promise<{ success: boolean; downloadCount: number }> {
    const shareId = typeof input === 'string' ? input : input.shareId;
    return this.shareTransport.trackDownload(shareId, signal);
  }
}

