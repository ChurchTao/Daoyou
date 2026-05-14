import { CreationWorkflowOptions } from '../core/types';
import { WorkflowActionKey } from './PhaseActionRegistry';

/**
 * WorkflowVariantPolicy
 *
 * 根据 workflow 选项（sync/async、autoMaterialize 等）决定：
 * 1. 哪个 action 响应材料分析事件（analyzeSync vs analyzeAsync）
 * 2. 蓝图组合后是继续实体化还是直接完成
 *
 * 通过将这些条件判断从 `CreationPhaseHandlerRegistry` 中分离，
 * 使得未来扩展 workflow variant（如 quick craft, expert craft）只需
 * 创建新的 WorkflowVariantPolicy 实例，而不需要修改 handler 注册逻辑。
 */
export class WorkflowVariantPolicy {
  private readonly autoMaterialize: boolean;
  private readonly materialAnalysisMode: 'sync' | 'async';

  constructor(options: Required<CreationWorkflowOptions>) {
    this.autoMaterialize = options.autoMaterialize;
    this.materialAnalysisMode = options.materialAnalysisMode;
  }

  /**
   * 根据当前 options 决定材料分析使用的动作键
   */
  resolveMaterialAnalysisAction(): WorkflowActionKey {
    return this.materialAnalysisMode === 'async' ? 'analyzeAsync' : 'analyzeSync';
  }

  /**
   * 根据当前 options 决定蓝图组合后的动作键
   */
  resolveBlueprintComposedAction(): WorkflowActionKey {
    if (this.materialAnalysisMode === 'async') {
      return 'enrichNaming';
    }
    return this.autoMaterialize ? 'materializeOrComplete' : 'completeWorkflow';
  }

  /**
   * 是否启用异步材料分析
   */
  isAsyncAnalysis(): boolean {
    return this.materialAnalysisMode === 'async';
  }

  /**
   * 是否自动实体化产出
   */
  isAutoMaterialize(): boolean {
    return this.autoMaterialize;
  }

  /**
   * 从 CreationWorkflowOptions 创建策略实例
   * 应用默认值
   */
  static fromOptions(options: CreationWorkflowOptions = {}): WorkflowVariantPolicy {
    return new WorkflowVariantPolicy({
      autoMaterialize: options.autoMaterialize ?? true,
      materialAnalysisMode: options.materialAnalysisMode ?? 'sync',
    });
  }
}
