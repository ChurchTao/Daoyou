import type { Artifact, Consumable, Material } from '@/types/cultivator';

/**
 * 资源类型枚举
 *
 * 通用资源类型（资源引擎直接处理）：
 * - spirit_stones: 灵石
 * - lifespan: 寿元
 * - cultivation_exp: 修为
 * - comprehension_insight: 感悟值
 * - material: 材料
 * - artifact: 法宝
 * - consumable: 消耗品
 *
 * 副本特有类型（副本系统内部处理）：
 * - hp_loss: 气血损耗（虚拟累积）
 * - mp_loss: 灵力损耗（虚拟累积）
 * - weak: 陷入虚弱（映射为 weakness 状态）
 * - battle: 遭遇战斗
 * - artifact_damage: 法宝损坏
 */
export type ResourceType =
  | 'spirit_stones'
  | 'lifespan'
  | 'cultivation_exp'
  | 'comprehension_insight'
  | 'material'
  | 'artifact'
  | 'consumable'
  // 副本特有类型
  | 'hp_loss'
  | 'mp_loss'
  | 'weak'
  | 'battle'
  | 'artifact_damage';

/**
 * 资源操作请求
 */
export interface ResourceOperation {
  type: ResourceType;
  value: number; // 数量（正数表示增加，负数表示减少）
  name?: string; // 资源名称（材料/法宝/消耗品使用）
  data?: Partial<Material> | Partial<Artifact> | Partial<Consumable>; // 完整数据（获得物品时使用）
  metadata?: Record<string, unknown>; // 元数据
}

/**
 * 资源校验结果
 */
export interface ResourceValidationResult {
  valid: boolean;
  missing?: ResourceOperation[]; // 缺少的资源
  errors?: string[];
}

/**
 * 资源操作结果
 */
export interface ResourceOperationResult {
  success: boolean;
  operations: ResourceOperation[];
  errors?: string[];
}

/**
 * 资源事务操作选项
 */
export interface ResourceTransactionOptions {
  dryRun?: boolean; // 仅校验，不实际执行
  userId: string;
  cultivatorId: string;
}
