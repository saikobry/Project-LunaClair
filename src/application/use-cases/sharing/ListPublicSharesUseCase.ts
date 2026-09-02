import type {
  ShareTransport,
  ListPublicSharesParams,
  ListPublicSharesResult,
} from '../../../domain/sharing/models/sharing.types';

export class ListPublicSharesUseCase {
  private readonly shareTransport: ShareTransport;

  constructor(shareTransport: ShareTransport) {
    this.shareTransport = shareTransport;
  }

  async execute(params: ListPublicSharesParams = {}, signal?: AbortSignal): Promise<ListPublicSharesResult> {
    return this.shareTransport.listPublicShares(params, signal);
  }
}
