import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { setupApiMocks, resetDatabase } from '../helpers/e2e-setup';
import { cloneShareToLibrary, routeShare } from '../helpers/share-seed';
import { cellStructure } from '../helpers/fixtures/cellStructure';

interface ExportedPackage {
  format: string;
  schemaVersion: number;
  metadata: { title: string };
  materials: Array<{ id: string; title: string; documentContent: string }>;
  questions: Array<{ id: string; materialId: string; prompt: string }>;
  quizzes: Array<{
    id: string;
    materialId: string;
    title: string;
    items: Array<{ questionId: string; order: number }>;
  }>;
}

let workspaceUrl = '';

test.describe('Study Package (.lcpack) Export & Import E2E', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page);
    await setupApiMocks(page);
    await routeShare(page, cellStructure);
    workspaceUrl = await cloneShareToLibrary(page, cellStructure, 'read');
  });

  test('exports material as .lcpack, verifies package integrity, and imports it via /import with preview dialog', async ({ page }) => {
    // 1. Navigate to the captured cloned workspace
    await page.goto(workspaceUrl);
    await expect(page.getByRole('heading', { name: cellStructure.title }).first()).toBeVisible({ timeout: 10000 });

    // 2. Trigger "Export as .lcpack" and capture the browser download
    const exportBtn = page.getByRole('button', { name: /Export as \.lcpack/i }).first();
    await expect(exportBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    // Verify downloaded filename is safe and has .lcpack extension
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.lcpack$/);
    expect(filename).not.toContain(':');
    expect(filename).not.toContain('/');

    // 3. Inspect the physical exported .lcpack file content
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const fileContent = fs.readFileSync(downloadPath!, 'utf-8');
    const parsedPackage = JSON.parse(fileContent) as ExportedPackage;

    // Verify package domain invariants and fixture fidelity.
    expect(parsedPackage.format).toBe('lcpack');
    expect(parsedPackage.schemaVersion).toBe(1);
    expect(parsedPackage.metadata.title).toBe(cellStructure.title);
    expect(parsedPackage.materials).toHaveLength(1);
    expect(parsedPackage.materials[0].documentContent).toBe(cellStructure.package.materials[0].documentContent);

    const localMaterialId = new URL(workspaceUrl).pathname.split('/').filter(Boolean).at(-1);
    expect(localMaterialId).toBeTruthy();
    const exportedMaterial = parsedPackage.materials[0];
    const exportedQuestionById = new Map(parsedPackage.questions.map((question) => [question.id, question]));
    const publishedIds = new Set<string>([
      ...cellStructure.package.materials.map((material) => material.id),
      ...cellStructure.package.questions.map((question) => question.id),
      ...cellStructure.package.quizzes.map((quiz) => quiz.id),
    ]);
    const exportedIds = new Set([
      ...parsedPackage.materials.map((material) => material.id),
      ...parsedPackage.questions.map((question) => question.id),
      ...parsedPackage.quizzes.map((quiz) => quiz.id),
    ]);

    // Every published entity id must be remapped; the local material id must
    // not leak into the export either.
    expect([...exportedIds].filter((id) => publishedIds.has(id))).toEqual([]);
    expect(exportedMaterial.id).not.toBe(cellStructure.package.materials[0].id);
    expect(exportedMaterial.id).not.toBe(localMaterialId);
    expect(exportedIds.size).toBe(publishedIds.size);

    // Relationships must remain the same graph, not merely internally valid.
    expect(parsedPackage.questions).toHaveLength(cellStructure.package.questions.length);
    expect(parsedPackage.quizzes).toHaveLength(cellStructure.package.quizzes.length);
    for (const question of parsedPackage.questions) {
      expect(question.materialId).toBe(exportedMaterial.id);
    }
    for (const quiz of parsedPackage.quizzes) {
      expect(quiz.materialId).toBe(exportedMaterial.id);
      for (const item of quiz.items) {
        expect(exportedQuestionById.get(item.questionId)).toBeDefined();
      }
    }

    const publishedPracticeQuiz = cellStructure.package.quizzes.find(
      (quiz) => quiz.title === 'Cell Structure Quiz',
    );
    const exportedPracticeQuiz = parsedPackage.quizzes.find((quiz) => quiz.title === 'Cell Structure Quiz');
    expect(publishedPracticeQuiz).toBeDefined();
    expect(exportedPracticeQuiz).toBeDefined();
    const expectedPracticePrompts = publishedPracticeQuiz!.items.map(
      (item) => cellStructure.package.questions.find((question) => question.id === item.questionId)?.prompt,
    );
    expect(
      exportedPracticeQuiz!.items.map((item) => exportedQuestionById.get(item.questionId)?.prompt),
    ).toEqual(expectedPracticePrompts);

    // 4. Navigate to /import
    await page.goto('/import');
    await expect(page.getByText('Drag & drop your study materials')).toBeVisible({ timeout: 10000 });

    // 5. Upload the exported .lcpack file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: filename,
        mimeType: 'application/vnd.lunaclair.package+json',
        buffer: Buffer.from(fileContent, 'utf-8'),
      },
    ]);

    // 6. Assert StudyPackagePreviewModal appears with authoritative inspectStudyPackage metrics
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByRole('heading', { name: cellStructure.title })).toBeVisible();
    await expect(dialog.getByText('Package Contents')).toBeVisible();
    await expect(dialog.getByText('Materials')).toBeVisible();
    await expect(dialog.getByText('Questions')).toBeVisible();
    await expect(dialog.getByText('Quizzes')).toBeVisible();

    // 7. Click "Import to Library"
    const confirmImportBtn = dialog.getByRole('button', { name: /Import to Library/i });
    await expect(confirmImportBtn).toBeEnabled();
    await confirmImportBtn.click();

    // 8. Verify preview modal closes and success toast is shown
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Study package imported successfully/i)).toBeVisible({ timeout: 5000 });

    // 9. Navigate to the Library and assert two materials now exist (original + imported copy)
    await page.goto('/library');
    const libraryCards = page.getByText('Cell Structure & Function');
    await expect(libraryCards.first()).toBeVisible({ timeout: 10000 });
  });
});
