import { MaterializeStudyPackageUseCase } from '../../../application/use-cases/package/MaterializeStudyPackageUseCase';
import { ImportStudyPackageUseCase } from '../../../application/use-cases/package/ImportStudyPackageUseCase';
import { PublishStudyPackageUseCase } from '../../../application/use-cases/sharing/PublishStudyPackageUseCase';
import { FetchPublishedShareUseCase } from '../../../application/use-cases/sharing/FetchPublishedShareUseCase';
import { TrackShareDownloadUseCase } from '../../../application/use-cases/sharing/TrackShareDownloadUseCase';
import { DeletePublishedShareUseCase } from '../../../application/use-cases/sharing/DeletePublishedShareUseCase';
import { ListPublicSharesUseCase } from '../../../application/use-cases/sharing/ListPublicSharesUseCase';
import { ClonePublishedShareUseCase } from '../../../application/use-cases/sharing/ClonePublishedShareUseCase';
import type { Repositories } from '../createRepositories';

export function createPackageUseCases(repositories: Repositories) {
    const materializeStudyPackage = new MaterializeStudyPackageUseCase(
        repositories.libraryRepository,
        repositories.documentContentRepository,
        repositories.questionRepository,
        repositories.quizRepository,
        repositories.importAssetRepository,
    );

    const importStudyPackage = new ImportStudyPackageUseCase(repositories.db);
    const fetchPublishedShare = new FetchPublishedShareUseCase(repositories.shareTransport);
    const trackShareDownload = new TrackShareDownloadUseCase(repositories.shareTransport);
    const deletePublishedShare = new DeletePublishedShareUseCase(repositories.shareTransport);
    const listPublicShares = new ListPublicSharesUseCase(repositories.shareTransport);

    const publishStudyPackage = new PublishStudyPackageUseCase(
        materializeStudyPackage,
        repositories.shareTransport,
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
