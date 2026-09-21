import { describe, expect, it } from 'vitest';
import { SetSelectionThreadModeUseCase } from '../SetSelectionThreadModeUseCase';
import { InMemoryPreferencesRepository } from '../../../../test/mocks/inMemoryPreferencesRepository';

describe('SetSelectionThreadModeUseCase', () => {
  it('writes the selection thread mode to the preferences repository', async () => {
    const prefRepo = new InMemoryPreferencesRepository();
    const useCase = new SetSelectionThreadModeUseCase(prefRepo);

    expect(await prefRepo.getAiSelectionThreadMode()).toBe('latest');

    await useCase.execute('new');
    expect(await prefRepo.getAiSelectionThreadMode()).toBe('new');

    await useCase.execute('latest');
    expect(await prefRepo.getAiSelectionThreadMode()).toBe('latest');
  });
});
