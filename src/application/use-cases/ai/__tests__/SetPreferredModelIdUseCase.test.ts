import { describe, expect, it } from 'vitest';
import { SetPreferredModelIdUseCase } from '../SetPreferredModelIdUseCase';
import { InMemoryPreferencesRepository } from '../../../../test/mocks/inMemoryPreferencesRepository';

describe('SetPreferredModelIdUseCase', () => {
  it('writes the preferred model id to the preferences repository', async () => {
    const prefRepo = new InMemoryPreferencesRepository();
    const useCase = new SetPreferredModelIdUseCase(prefRepo);

    expect(await prefRepo.getPreferredModelId()).toBeNull();

    await useCase.execute('ukisai-swift-max');
    expect(await prefRepo.getPreferredModelId()).toBe('ukisai-swift-max');
  });
});
