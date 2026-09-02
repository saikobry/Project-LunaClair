/**
 * Application use case to delete a published StudyPackage from the cloud.
 */
import type { ShareTransport } from '../../../domain/sharing/models/sharing.types';

export interface DeletePublishedShareInput {
  shareId: string;
  authToken?: string;
}

export class DeletePublishedShareUseCase {
  private readonly shareTransport: ShareTransport;

  constructor(shareTransport: ShareTransport) {
    this.shareTransport = shareTransport;
  }

  async execute(input: DeletePublishedShareInput, signal?: AbortSignal): Promise<void> {
    return this.shareTransport.delete(input.shareId, input.authToken, signal);
  }
}
