import { CreationTagContainer } from './core/GameplayTags';
import { CreationPhase } from './core/types';
import {
  CreationSessionInput,
  CreationSessionState,
  isCreationProductType,
} from './types';

/*
 * CreationSession: 单次造物会话的领域状态容器。
 * 责任：持有 sessionId、当前阶段（phase）、输入、标签和中间计算结果等状态；
 * 提供对 phase 的更新与标签同步方法（setPhase / syncTags）。
 */
/*
 * CreationSession: 会话级状态容器
 * 说明：封装一次造物流程的全量状态（材料指纹、意图、预算、词缀池、抽选结果、蓝图、实体化产物）
 * 以及用于在 Orchestrator 流程中传递与持久化的必要辅助方法。
 */
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