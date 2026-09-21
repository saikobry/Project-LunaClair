import type { AiGroundingMode, AiSelectionThreadMode } from '../../domain/ai/models/ai.types';
import type { PreferencesRepository } from '../../domain/preferences/repositories/PreferencesRepository';

/**
 * In-memory `PreferencesRepository` for tests.
 *
 * The port exposes a fixed set of values, so fields are the whole implementation. Shared by the AI
 * use-case suites and the chat harness, which need to construct `CreateAiThreadUseCase` without a
 * Dexie database.
 */
export class InMemoryPreferencesRepository implements PreferencesRepository {
  private groundingDefault: AiGroundingMode;
  private selectionThreadMode: AiSelectionThreadMode;

  constructor(initial: AiGroundingMode = 'whole') {
    this.groundingDefault = initial;
    this.selectionThreadMode = 'latest';
  }

  async getAiGroundingDefault(): Promise<AiGroundingMode> {
    return this.groundingDefault;
  }

  async setAiGroundingDefault(mode: AiGroundingMode): Promise<void> {
    this.groundingDefault = mode;
  }

  async getAiSelectionThreadMode(): Promise<AiSelectionThreadMode> {
    return this.selectionThreadMode;
  }

  async setAiSelectionThreadMode(mode: AiSelectionThreadMode): Promise<void> {
    this.selectionThreadMode = mode;
  }
}
