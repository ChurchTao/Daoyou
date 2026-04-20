import { CreationSession } from '../CreationSession';

/**
 * 工作流阶段动作键
 * 每个键对应 workflow 中的一个逻辑步骤
 */
export type WorkflowActionKey =
  | 'analyzeSync'
  | 'analyzeAsync'
  | 'resolveIntent'
  | 'validateRecipe'
  | 'budgetEnergy'
  | 'buildAffixPool'
  | 'rollAffixes'
  | 'composeBlueprint'
  | 'materializeOrComplete'
  | 'completeWorkflow';

/**
 * 阶段动作：接收 session，执行对应的业务步骤
 * 可以是同步或异步
 */
export type PhaseAction = (session: CreationSession) => void | Promise<void>;

/**
 * PhaseActionRegistry
 *
 * 将 WorkflowActionKey 映射到具体的 PhaseAction 实现。
 * 默认行为由 CreationOrchestrator 注册；外部可通过 override() 替换单个 action。
 *
 * 这使得 workflow variant（例如 expert craft / quick craft）可以在不改动
 * orchestrator 主流程的情况下，仅替换特定阶段的行为。
 */
export class PhaseActionRegistry {
  private readonly actions = new Map<WorkflowActionKey, PhaseAction>();

  /**
   * 注册一批默认动作（通常由 CreationOrchestrator 在构造时调用）
   */
  registerDefaults(
    defaults: Partial<Record<WorkflowActionKey, PhaseAction>>,
  ): void {
    for (const [key, action] of Object.entries(defaults) as [WorkflowActionKey, PhaseAction][]) {
      if (!this.actions.has(key)) {
        this.actions.set(key, action);
      }
    }
  }

  /**
   * 覆盖某个阶段的动作实现
   * 用于 workflow variant 替换特定步骤
   */
  override(key: WorkflowActionKey, action: PhaseAction): void {
    this.actions.set(key, action);
  }

  /**
   * 获取指定 key 的动作
   * 若未注册则返回 undefined（调用方应做防护）
   */
  get(key: WorkflowActionKey): PhaseAction | undefined {
    return this.actions.get(key);
  }

  /**
   * 执行指定 key 的动作
   * 若未找到实现则静默忽略（workflow 不中断）
   */
  async execute(key: WorkflowActionKey, session: CreationSession): Promise<void> {
    const action = this.actions.get(key);
    if (action) {
      await action(session);
    }
  }

  /**
   * 检查某个 key 是否已注册
   */
  has(key: WorkflowActionKey): boolean {
    return this.actions.has(key);
  }
}
