import { describe, expect, it } from 'vitest';
import { SetGroundingDefaultUseCase } from '../SetGroundingDefaultUseCase';
import { InMemoryPreferencesRepository } from '../../../../test/mocks/inMemoryPreferencesRepository';

describe('SetGroundingDefaultUseCase', () => {
  it('writes the grounding mode to the preferences repository', async () => {
    const prefRepo = new InMemoryPreferencesRepository('whole');
    const useCase = new SetGroundingDefaultUseCase(prefRepo);

    await useCase.execute('none');
    expect(await prefRepo.getAiGroundingDefault()).toBe('none');

    await useCase.execute('whole');
    expect(await prefRepo.getAiGroundingDefault()).toBe('whole');
  });
});
