/**
 * Application use case to materialize a local material as a StudyPackage and publish it to the cloud.
 */
import type { MaterializeStudyPackageUseCase } from '../package/MaterializeStudyPackageUseCase';
import { validateStudyPackage } from '../../../domain/package/engines/validateStudyPackage';
import type {
  PublishShareOptions,
  PublishShareResult,
  ShareTransport,
} from '../../../domain/sharing/models/sharing.types';

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

    // The local publish gate. The Worker stays the server-side authority and refuses the same package,
    // so this never replaces it — it is here because `MaterializeStudyPackageUseCase` copies each
    // question's payload VERBATIM, so a question imported from a legacy malformed share is
    // re-materialized exactly as malformed as it arrived. Without this check the round trip is the
    // only gate, and the user learns about it from a network error instead of a named question.
    const validation = validateStudyPackage(pkg);
    if (!validation.isValid) {
      throw new Error(
        `Cannot publish this material: ${validation.errors[0] ?? 'its study package failed validation.'}`,
      );
    }

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
