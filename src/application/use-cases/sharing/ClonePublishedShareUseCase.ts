import type { FetchPublishedShareUseCase } from './FetchPublishedShareUseCase';
import type { ImportStudyPackageUseCase, ImportStudyPackageResult } from '../package/ImportStudyPackageUseCase';
import type { TrackShareDownloadUseCase } from './TrackShareDownloadUseCase';
import type { PublishedShare } from '../../../domain/sharing/models/sharing.types';

export interface ClonePublishedShareInput {
  shareId: string;
  passcode?: string;
  targetSubjectId?: string;
  targetTermId?: string;
}

export interface ClonePublishedShareResult {
  share: PublishedShare;
  importResult: ImportStudyPackageResult;
}

export class ClonePublishedShareUseCase {
  private readonly fetchPublishedShare: FetchPublishedShareUseCase;
  private readonly importStudyPackage: ImportStudyPackageUseCase;
  private readonly trackShareDownload: TrackShareDownloadUseCase;

  constructor(
    fetchPublishedShare: FetchPublishedShareUseCase,
    importStudyPackage: ImportStudyPackageUseCase,
    trackShareDownload: TrackShareDownloadUseCase,
  ) {
    this.fetchPublishedShare = fetchPublishedShare;
    this.importStudyPackage = importStudyPackage;
    this.trackShareDownload = trackShareDownload;
  }

  async execute(input: ClonePublishedShareInput, signal?: AbortSignal): Promise<ClonePublishedShareResult> {
    // 1. Fetch & validate remote published package
    const share = await this.fetchPublishedShare.execute(
      {
        shareId: input.shareId,
        passcode: input.passcode,
      },
      signal,
    );

    // 2. Commit atomic transaction to Dexie with target destination
    const importResult = await this.importStudyPackage.execute({
      package: share.package,
      targetSubjectId: input.targetSubjectId,
      targetTermId: input.targetTermId,
    });

    // 3. Strict requirement: Track download telemetry ONLY after successful Dexie commit
    try {
      await this.trackShareDownload.execute({ shareId: input.shareId }, signal);
    } catch {
      // Non-blocking telemetry tracking failure
    }

    return {
      share,
      importResult,
    };
  }
}
