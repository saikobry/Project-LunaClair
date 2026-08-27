/**
 * Application use case to fetch and validate a published StudyPackage from the cloud.
 */
import type { PublishedShare, ShareTransport } from '../../../domain/sharing/sharing.types';
import { validateStudyPackage } from '../../../domain/package/validateStudyPackage';

export interface FetchPublishedShareInput {
  shareId: string;
  passcode?: string;
}

export class FetchPublishedShareUseCase {
  private readonly shareTransport: ShareTransport;

  constructor(shareTransport: ShareTransport) {
    this.shareTransport = shareTransport;
  }

  async execute(input: FetchPublishedShareInput, signal?: AbortSignal): Promise<PublishedShare> {
    const share = await this.shareTransport.fetch(input.shareId, input.passcode, signal);

    // Client-side domain validation for defense-in-depth
    const validation = validateStudyPackage(share.package);
    if (!validation.isValid) {
      throw new Error(
        `Remote study package failed domain validation: ${validation.errors.join('; ')}`,
      );
    }

    return share;
  }
}
