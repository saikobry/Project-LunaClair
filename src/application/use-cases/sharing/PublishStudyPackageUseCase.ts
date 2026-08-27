/**
 * Application use case to materialize a local material as a StudyPackage and publish it to the cloud.
 */
import type { MaterializeStudyPackageUseCase } from '../package/MaterializeStudyPackageUseCase';
import type {
  PublishShareOptions,
  PublishShareResult,
  ShareTransport,
} from '../../../domain/sharing/sharing.types';

export interface PublishStudyPackageInput extends PublishShareOptions {
  materialId: string;
}

export class PublishStudyPackageUseCase {
  private readonly materializeUseCase: MaterializeStudyPackageUseCase;
  private readonly shareTransport: ShareTransport;

  constructor(
    materializeUseCase: MaterializeStudyPackageUseCase,
    shareTransport: ShareTransport,
  ) {
    this.materializeUseCase = materializeUseCase;
    this.shareTransport = shareTransport;
  }

  async execute(
    input: PublishStudyPackageInput,
    signal?: AbortSignal,
  ): Promise<PublishShareResult> {
    const pkg = await this.materializeUseCase.execute({ materialId: input.materialId });

    return this.shareTransport.publish(
      pkg,
      {
        accessType: input.accessType,
        passcode: input.passcode,
        expiresAt: input.expiresAt,
        authToken: input.authToken,
        userId: input.userId,
      },
      signal,
    );
  }
}
