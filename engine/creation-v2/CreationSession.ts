import { CreationTagContainer } from './core/GameplayTags';
import { CreationPhase } from './core/types';
import {
  CreationSessionInput,
  CreationSessionState,
  isCreationProductType,
} from './types';

export class CreationSession {
  readonly id: string;
  readonly state: CreationSessionState;
  readonly tags = new CreationTagContainer();

  constructor(input: CreationSessionInput) {
    if (!isCreationProductType(input.productType)) {
      throw new Error(`Unsupported creation product type: ${input.productType}`);
    }

    this.id = input.sessionId ?? crypto.randomUUID();
    this.state = {
      id: this.id,
      phase: CreationPhase.INIT,
      input,
      tags: [],
      materialFingerprints: [],
      affixPool: [],
      rolledAffixes: [],
    };
  }

  setPhase(phase: CreationPhase): void {
    this.state.phase = phase;
  }

  syncTags(tags: string[]): void {
    this.tags.clear();
    this.tags.addTags(tags);
    this.state.tags = this.tags.getTags();
  }
}