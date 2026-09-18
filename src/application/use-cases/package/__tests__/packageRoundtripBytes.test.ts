// @vitest-environment node
/**
 * Byte-identity round trip: the acceptance criterion for the local asset model.
 *
 * Runs under the `node` environment **on purpose**. The rest of the suite runs under jsdom, where
 * the `Blob` the page creates is jsdom's `Blob` — a class fake-indexeddb's structured clone cannot
 * serialize, so a stored `Blob` reads back as an empty plain object. Byte comparisons there are
 * worse than impossible: a round-tripped blob encodes as `"[object Object]"`, so comparing two
 * round-tripped blobs *passes* while proving nothing. In `node` the real `Blob` survives IndexedDB
 * intact, so the bytes are comparable.
 *
 * Cited by `docs/architecture/plans/lc-asset-resolution-plan.md` §8.2.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieLibraryRepository } from '../../../../infrastructure/database/repositories/DexieLibraryRepository';
import { DexieDocumentContentRepository } from '../../../../infrastructure/database/repositories/DexieDocumentContentRepository';
import { DexieQuestionRepository } from '../../../../infrastructure/database/repositories/DexieQuestionRepository';
import { DexieQuizRepository } from '../../../../infrastructure/database/repositories/DexieQuizRepository';
import { DexieAssetRepository } from '../../../../infrastructure/database/repositories/DexieAssetRepository';
import { DexieStudyPackageImportService } from '../../../../infrastructure/database/services/DexieStudyPackageImportService';
import { MaterializeStudyPackageUseCase } from '../MaterializeStudyPackageUseCase';
import { ImportStudyPackageUseCase } from '../ImportStudyPackageUseCase';
import { parseJsonFromString as parsePackageFromJson } from '../../../../shared/utils/jsonBlobParser';
import {
    blobToBase64,
    base64ToUint8Array,
    serializePackageToJson,
} from '../../../../domain/package/engines/StudyPackageSerializer';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('StudyPackage byte-identity round trip', () => {
    const materialId = 'mat_bytes_1';
    const documentId = 'doc_bytes_1';
    const importedAt = '2026-09-01T00:00:00.000Z';

    /** Distinct, non-trivial payloads, so a swapped payload cannot compare equal by accident. */
    const sources = [
        {
            assetId: 'asset-alpha',
            filename: 'figure-alpha.png',
            bytes: Uint8Array.from([137, 80, 78, 71, 1, 2, 3, 4, 250, 255]),
        },
        {
            assetId: 'asset-beta',
            filename: 'figure-beta.png',
            bytes: Uint8Array.from([137, 80, 78, 71, 9, 8, 7, 6, 200, 100]),
        },
        {
            assetId: 'asset-gamma',
            filename: 'figure-gamma.png',
            bytes: Uint8Array.from([137, 80, 78, 71, 42, 43, 44, 45, 46, 47]),
        },
    ];

    async function resetDatabase() {
        await Promise.all([
            db.materials.clear(),
            db.documentContents.clear(),
            db.questions.clear(),
            db.quizzes.clear(),
            db.localAssets.clear(),
        ]);
    }

    beforeEach(resetDatabase);
    afterEach(resetDatabase);

    function createUseCases() {
        return {
            materialize: new MaterializeStudyPackageUseCase(
                new DexieLibraryRepository(),
                new DexieDocumentContentRepository(),
                new DexieQuestionRepository(),
                new DexieQuizRepository(),
                new DexieAssetRepository(),
            ),
            import: new ImportStudyPackageUseCase(new DexieStudyPackageImportService(db)),
        };
    }

    async function seedMaterialWithFigures() {
        const material: StudyMaterial = {
            id: materialId,
            title: 'Figure Byte Identity',
            description: 'Three figures that must survive a package round trip.',
            documentId,
            order: 1,
            createdAt: importedAt,
            updatedAt: importedAt,
        };
        await db.materials.put(material);

        // Document order deliberately differs from the export sort order (alpha, beta, gamma).
        await db.documentContents.put({
            documentId,
            title: material.title,
            content: [
                '# Figures',
                '![Gamma](lc-asset://asset-gamma)',
                '![Alpha](lc-asset://asset-alpha)',
                '![Beta](lc-asset://asset-beta)',
            ].join('\n'),
            updatedAt: importedAt,
        });

        for (const source of sources) {
            await db.localAssets.put({
                assetId: source.assetId,
                materialId,
                blob: new Blob([source.bytes], { type: 'image/png' }),
                mimeType: 'image/png',
                filename: source.filename,
                importedAt,
            });
        }
    }

    function referencesIn(content: string): string[] {
        return [...content.matchAll(/lc-asset:\/\/([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
    }

    it('runs in an environment where stored Blob bytes survive', () => {
        // Canary for the directive above. If this test ever runs under jsdom, byte comparisons
        // silently stop meaning anything, so the environment itself is asserted.
        expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
    });

    it('keeps every figure byte-identical through export and re-import', async () => {
        await seedMaterialWithFigures();
        const { materialize, import: importUseCase } = createUseCases();

        const sourceBase64 = new Map<string, string>();
        for (const source of sources) {
            sourceBase64.set(source.assetId, await blobToBase64(new Blob([source.bytes])));
        }

        // --- Export leg: the bytes read out of IndexedDB reach the package unchanged. ---
        const pkg = await materialize.execute({ materialId });
        const orderedSources = [...sources].sort((a, b) => a.filename.localeCompare(b.filename));

        expect(pkg.assets?.map((asset) => [asset.id, asset.filename])).toEqual([
            ['pkg_asset_1', 'figure-alpha.png'],
            ['pkg_asset_2', 'figure-beta.png'],
            ['pkg_asset_3', 'figure-gamma.png'],
        ]);

        for (const [index, source] of orderedSources.entries()) {
            const packaged = pkg.assets?.find((asset) => asset.id === `pkg_asset_${index + 1}`);
            expect(packaged?.dataBase64).toBe(sourceBase64.get(source.assetId));
        }

        // References were rewired by identity, preserving document order (gamma, alpha, beta).
        expect(referencesIn(pkg.materials[0].documentContent)).toEqual([
            'pkg_asset_3',
            'pkg_asset_1',
            'pkg_asset_2',
        ]);

        // --- Import leg: a fresh local graph holds the same bytes behind the same references. ---
        const parsed = parsePackageFromJson(serializePackageToJson(pkg));
        const imported = await importUseCase.execute({ package: parsed });

        const importedMaterial = await db.materials.get(imported.materialIds[0]);
        const importedDoc = await db.documentContents.get(importedMaterial!.documentId);
        const referencedIds = referencesIn(importedDoc?.content ?? '');
        expect(referencedIds).toHaveLength(3);
        expect(referencedIds.some((id) => id.startsWith('pkg_'))).toBe(false);

        const resolved: Array<[string, string]> = [];
        for (const assetId of referencedIds) {
            const row = await db.localAssets.get(assetId);
            expect(row).toBeDefined();
            expect(row?.materialId).toBe(imported.materialIds[0]);
            resolved.push([row!.filename, await blobToBase64(row!.blob)]);
        }

        // Each reference still resolves to its own file, byte for byte, in the original order.
        expect(resolved).toEqual([
            ['figure-gamma.png', sourceBase64.get('asset-gamma')],
            ['figure-alpha.png', sourceBase64.get('asset-alpha')],
            ['figure-beta.png', sourceBase64.get('asset-beta')],
        ]);

        // Decoding guard: the base64 above must be the real bytes read back out of IndexedDB, not a
        // degenerate encoding of a lost Blob. (`"[object Object]"` is not valid base64, so `atob`
        // would throw here — this is the assertion that the storage hop actually carried bytes.)
        const bytesByFilename = new Map(sources.map((s) => [s.filename, s.bytes]));
        for (const [filename, base64] of resolved) {
            const decoded = Array.from(base64ToUint8Array(base64));
            expect(decoded.length).toBeGreaterThan(9); // Fails loudly if the Blob came back empty.
            expect(decoded).toEqual(Array.from(bytesByFilename.get(filename)!));
        }
    });

    it('keeps the bytes stable across a second export of the imported graph', async () => {
        await seedMaterialWithFigures();
        const { materialize, import: importUseCase } = createUseCases();

        const firstExport = await materialize.execute({ materialId });
        const imported = await importUseCase.execute({
            package: parsePackageFromJson(serializePackageToJson(firstExport)),
        });

        // Re-export the imported (cloned) material — the hop that used to ship a single figure.
        const secondExport = await materialize.execute({ materialId: imported.materialIds[0] });

        expect(secondExport.assets?.map((asset) => asset.filename)).toEqual([
            'figure-alpha.png',
            'figure-beta.png',
            'figure-gamma.png',
        ]);

        const firstBase64 = new Map(
            (firstExport.assets ?? []).map((asset) => [asset.filename, asset.dataBase64]),
        );
        const bytesByFilename = new Map(sources.map((s) => [s.filename, s.bytes]));
        for (const asset of secondExport.assets ?? []) {
            expect(asset.dataBase64).toBe(firstBase64.get(asset.filename));
            // Both hops carried the real bytes, not a re-encoding of a lost Blob.
            expect(Array.from(base64ToUint8Array(asset.dataBase64))).toEqual(
                Array.from(bytesByFilename.get(asset.filename)!),
            );
        }

        expect(referencesIn(secondExport.materials[0].documentContent)).toEqual([
            'pkg_asset_3',
            'pkg_asset_1',
            'pkg_asset_2',
        ]);
    });
});
