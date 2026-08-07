/**
 * 多人战斗技能库（library）
 *
 * 专用于 battle-team 的可扩充技能集，从零开始积累。
 * 每个技能为独立文件，通过 index.ts 统一导出。
 *
 * 技能类型对照：
 * - aura（光环）：存活即生效，不需要行动 → RecoveryAura, ComboAura
 * - active（主动）：行动时判定是否发动，含蓄力 → ChargeAbility, TauntAbility
 * - pursuit（追击）：每次基础攻击后有概率再触发 → Pursuit
 * - basic（普攻）：基础攻击 → BasicStrike（在 abilities/ 中）
 *
 * 新增技能时：
 * 1. 在本目录新建 XxxSkill.ts
 * 2. 在 index.ts 导出
 * 3. 在 presetLibraryUnits.ts 中挂载到测试单位
 */

export { RecoveryAura } from './RecoveryAura';
export { ComboAura } from './ComboAura';
export { Pursuit } from './Pursuit';
export type { PursuitOptions } from './Pursuit';
export { ChargeAbility } from './ChargeAbility';
export type { ChargeAbilityOptions } from './ChargeAbility';
export { TauntAbility } from './TauntAbility';
export type { TauntAbilityOptions } from './TauntAbility';
export { performBasicAttack, selectBasicAttackTarget } from './basicAttackHelpers';
