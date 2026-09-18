import { MaterializeStudyPackageUseCase } from '../../../application/use-cases/package/MaterializeStudyPackageUseCase';
import { ImportStudyPackageUseCase } from '../../../application/use-cases/package/ImportStudyPackageUseCase';
import { PublishStudyPackageUseCase } from '../../../application/use-cases/sharing/PublishStudyPackageUseCase';
import { FetchPublishedShareUseCase } from '../../../application/use-cases/sharing/FetchPublishedShareUseCase';
import { TrackShareDownloadUseCase } from '../../../application/use-cases/sharing/TrackShareDownloadUseCase';
import { DeletePublishedShareUseCase } from '../../../application/use-cases/sharing/DeletePublishedShareUseCase';
import { ListPublicSharesUseCase } from '../../../application/use-cases/sharing/ListPublicSharesUseCase';
import { ClonePublishedShareUseCase } from '../../../application/use-cases/sharing/ClonePublishedShareUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createPackageUseCases(infrastructure: Infrastructure) {
    const { repositories, transports, services } = infrastructure;

    const materializeStudyPackage = new MaterializeStudyPackageUseCase(
        repositories.library,
        repositories.documentContent,
        repositories.question,
        repositories.quiz,
        repositories.asset,
    );

    const importStudyPackage = new ImportStudyPackageUseCase(services.studyPackageImport);
    const fetchPublishedShare = new FetchPublishedShareUseCase(transports.share);
    const trackShareDownload = new TrackShareDownloadUseCase(transports.share);
    const deletePublishedShare = new DeletePublishedShareUseCase(transports.share);
    const listPublicShares = new ListPublicSharesUseCase(transports.share);

    const publishStudyPackage = new PublishStudyPackageUseCase(
        materializeStudyPackage,
        transports.share,
    );

    const clonePublishedShare = new ClonePublishedShareUseCase(
        fetchPublishedShare,
        importStudyPackage,
        trackShareDownload,
    );

    return {
        package: {
            materializeStudyPackage,
            importStudyPackage,
        },
        sharing: {
            publishStudyPackage,
            fetchPublishedShare,
            trackShareDownload,
            deletePublishedShare,
            listPublicShares,
            clonePublishedShare,
        },
    };
}
