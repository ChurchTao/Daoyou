/*
 * GameplayTags: 造物系统中的标签常量与容器实现。
 * - CreationTagContainer 提供层级标签查询（支持父标签匹配）
 * - CreationTags 为系统预定义标签集合（材料/意图/词缀/产物 等命名空间）
 */
import { CreationTagPath } from './types';

export class CreationTagContainer {
  private readonly tags = new Set<CreationTagPath>();

  addTags(tags: CreationTagPath[]): void {
    tags.forEach((tag) => this.tags.add(tag));
  }

  removeTags(tags: CreationTagPath[]): void {
    tags.forEach((tag) => this.tags.delete(tag));
  }

  hasTag(tag: CreationTagPath): boolean {
    if (!tag) {
      return false;
    }

    if (this.tags.has(tag)) {
      return true;
    }

    return this.getParentTags(tag).some((parentTag) => this.tags.has(parentTag));
  }

  hasAnyTag(tags: CreationTagPath[]): boolean {
    return tags.some((tag) => this.hasTag(tag));
  }

  hasAllTags(tags: CreationTagPath[]): boolean {
    return tags.every((tag) => this.hasTag(tag));
  }

  getTags(): CreationTagPath[] {
    return Array.from(this.tags);
  }

  clear(): void {
    this.tags.clear();
  }

  clone(): CreationTagContainer {
    const cloned = new CreationTagContainer();
    cloned.addTags(this.getTags());
    return cloned;
  }

  private getParentTags(tag: CreationTagPath): CreationTagPath[] {
    const parts = tag.split('.');
    const parents: CreationTagPath[] = [];

    for (let index = 1; index < parts.length; index++) {
      parents.push(parts.slice(0, index).join('.'));
    }

    return parents;
  }
}

export const CreationTags = {
  // 材料标签：用于材料指纹抽取阶段（MaterialFingerprint）与词缀候选筛选（AffixPoolBuild）
  MATERIAL: {
    ROOT: 'Material', // 材料命名空间根节点；用于统一前缀匹配（标签容器父级匹配）
    TYPE: 'Material.Type', // 材料类型总类；用于按大类筛选词缀候选池
    TYPE_HERB: 'Material.Type.Herb', // 草药材料；影响治疗/续航向词缀命中
    TYPE_ORE: 'Material.Type.Ore', // 矿石材料；影响防御/兵器向词缀命中
    TYPE_MONSTER: 'Material.Type.Monster', // 妖兽材料；影响爆发/掠夺向词缀命中
    TYPE_MANUAL: 'Material.Type.Manual', // 秘籍材料；影响功法/控制/悟性向词缀命中
    TYPE_SPECIAL: 'Material.Type.Special', // 特殊材料；用于 signature/mythic 等高阶词缀门槛
    TYPE_AUXILIARY: 'Material.Type.Auxiliary', // 辅材；用于补充配方意图与能量结构
    QUALITY: 'Material.Quality', // 材料品质域；用于品质门槛校验（minQuality/maxQuality）
    ELEMENT: 'Material.Element', // 材料元素域；用于元素偏好和元素词缀筛选
    SEMANTIC: 'Material.Semantic', // 材料语义根域；用于“语义父标签”匹配
    SEMANTIC_FLAME: 'Material.Semantic.Flame', // 火焰语义；用于火系伤害/灼烧类词缀
    SEMANTIC_FREEZE: 'Material.Semantic.Freeze', // 冰冻语义；用于减速/冻结/护盾类词缀
    SEMANTIC_THUNDER: 'Material.Semantic.Thunder', // 雷霆语义；用于爆发/蚀元/控制链词缀
    SEMANTIC_WIND: 'Material.Semantic.Wind', // 风行语义；用于身法/冷却节奏类词缀
    SEMANTIC_BLADE: 'Material.Semantic.Blade', // 刃击语义；用于暴击/攻击/处决类词缀
    SEMANTIC_GUARD: 'Material.Semantic.Guard', // 守御语义；用于减伤/反伤/免疫类词缀
    SEMANTIC_BURST: 'Material.Semantic.Burst', // 爆发语义；用于增伤/连段/斩杀类词缀
    SEMANTIC_SUSTAIN: 'Material.Semantic.Sustain', // 续航语义；用于治疗/吸取/回灵类词缀
    SEMANTIC_MANUAL: 'Material.Semantic.Manual', // 心法语义；用于功法/控制/冷却调制类词缀
    SEMANTIC_SPIRIT: 'Material.Semantic.Spirit', // 灵性语义；用于法系/护幕/灵力相关词缀
    SEMANTIC_EARTH: 'Material.Semantic.Earth', // 大地语义；用于厚重防御与稳态词缀
    SEMANTIC_METAL: 'Material.Semantic.Metal', // 金行语义；用于锋锐穿透与反制词缀
    SEMANTIC_WATER: 'Material.Semantic.Water', // 水行语义；用于恢复流转与柔化减伤词缀
    SEMANTIC_WOOD: 'Material.Semantic.Wood', // 木行语义；用于生长增益与持续恢复词缀
    SEMANTIC_POISON: 'Material.Semantic.Poison', // 毒性语义；用于减益叠层/持续耗损词缀
    SEMANTIC_DIVINE: 'Material.Semantic.Divine', // 神圣语义；用于高阶净化与庇护词缀
    SEMANTIC_CHAOS: 'Material.Semantic.Chaos', // 混沌语义；用于高波动复合效果词缀
    SEMANTIC_SPACE: 'Material.Semantic.Space', // 空间语义；用于位移/范围/折叠类构想词缀
    SEMANTIC_TIME: 'Material.Semantic.Time', // 时间语义；用于冷却、节奏、延时触发词缀
    SEMANTIC_LIFE: 'Material.Semantic.Life', // 生命语义；用于续命、复苏、再生类词缀
    RECIPE: 'Material.Recipe', // 材料配方域；用于配方命中和配方锁定阶段
  },

  // 意图标签：用于 Intent 解析阶段（CreationIntent）决定造物目标方向
  INTENT: {
    ROOT: 'Intent', // 意图命名空间根节点
    PRODUCT: 'Intent.Product', // 产物意图总类（技能/法宝/功法）
    PRODUCT_SKILL: 'Intent.Product.Skill', // 技能造物意图
    PRODUCT_ARTIFACT: 'Intent.Product.Artifact', // 法宝造物意图
    PRODUCT_GONGFA: 'Intent.Product.GongFa', // 功法造物意图
    OUTCOME: 'Intent.Outcome', // 结果形态总类
    OUTCOME_ACTIVE: 'Intent.Outcome.ActiveSkill', // 主动技能结果偏好
    OUTCOME_PASSIVE: 'Intent.Outcome.PassiveAbility', // 被动能力结果偏好
  },

  // 配方标签：用于 RecipeValidation / RecipeMatch 阶段决定可解锁词缀类别
  RECIPE: {
    ROOT: 'Recipe', // 配方命名空间根节点
    PRODUCT_BIAS: 'Recipe.ProductBias', // 配方产物倾向总类
    PRODUCT_BIAS_SKILL: 'Recipe.ProductBias.Skill', // 偏向生成技能
    PRODUCT_BIAS_ARTIFACT: 'Recipe.ProductBias.Artifact', // 偏向生成法宝
    PRODUCT_BIAS_GONGFA: 'Recipe.ProductBias.GongFa', // 偏向生成功法
    PRODUCT_BIAS_UTILITY: 'Recipe.ProductBias.Utility', // 偏向功能/辅助向结果
    INTENT: 'Recipe.Intent', // 配方意图域
    MATCHED: 'Recipe.Matched', // 配方已命中（用于调试与审计）
    GATED: 'Recipe.Gated', // 配方受门槛限制（能量/品质/材料）
    UNLOCKED: 'Recipe.Unlocked', // 配方已解锁（允许进入后续词缀抽取）
  },

  // 能量标签：用于 EnergyBudget 分配与词缀抽签停止条件判断
  ENERGY: {
    ROOT: 'Energy', // 能量命名空间根节点
    BASE: 'Energy.Base', // 基础能量来源（来自材料基础值）
    BONUS: 'Energy.Bonus', // 额外能量来源（配方/特殊材料奖励）
    RESERVED: 'Energy.Reserved', // 预留能量（用于保底产物或系统保留）
  },

  // 词缀分类标签：用于 AffixPoolBuild 阶段的分类过滤与候选池构建
  AFFIX: {
    ROOT: 'Affix', // 词缀命名空间根节点
    PREFIX: 'Affix.Prefix', // 前缀词缀（属性强化、战斗前置增强）
    SUFFIX: 'Affix.Suffix', // 后缀词缀（触发器、附加机制）
    CORE: 'Affix.Core', // 核心词缀（产物主机制）
    SIGNATURE: 'Affix.Signature', // 签名词缀（稀有、高辨识能力）
    RESONANCE: 'Affix.Resonance', // 共鸣词缀（同类语义放大）
    SYNERGY: 'Affix.Synergy', // 协同词缀（跨语义联动）
    MYTHIC: 'Affix.Mythic', // 神话词缀（终局稀有能力）
  },

  // 效果标签：用于定义词缀/能力效果语义，方便规则筛选与后续扩展
  EFFECT: {
    ROOT: 'Effect', // 效果命名空间根节点
    OFFENSIVE: 'Effect.Offensive', // 进攻效果（增伤、伤害链）
    DEFENSIVE: 'Effect.Defensive', // 防御效果（减伤、护盾、反伤）
    HEALING: 'Effect.Healing', // 治疗效果（回血、续航）
    CONTROL: 'Effect.Control', // 控制效果（眩晕、减速、限制行动）
    RESOURCE_DRAIN: 'Effect.ResourceDrain', // 资源吸取（吸血/吸蓝）
    RESOURCE_REGEN: 'Effect.ResourceRegen', // 资源恢复（回血/回蓝）
    CONDITIONAL: 'Effect.Conditional', // 条件效果（基于血量/标签触发）
    TRIGGER: 'Effect.Trigger', // 触发效果（事件触发链）
    IMMUNITY: 'Effect.Immunity', // 免疫效果（伤害免疫/状态免疫）
  },

  // 战斗特性标签：用于描述玩法风格，在词缀设计与组合校验中做语义分桶
  COMBAT_TRAIT: {
    ROOT: 'CombatTrait', // 战斗特性命名空间根节点
    EXECUTE: 'CombatTrait.Execute', // 斩杀向特性（低血终结）
    REFLECT: 'CombatTrait.Reflect', // 反伤向特性（受击反制）
    LIFESTEAL: 'CombatTrait.Lifesteal', // 吸血向特性（伤害转回复）
    MANA_THIEF: 'CombatTrait.ManaThief', // 吸蓝向特性（资源掠夺）
    COOLDOWN_MASTER: 'CombatTrait.CooldownMaster', // 冷却掌控（提速/封锁）
    DISPEL: 'CombatTrait.Dispel', // 驱散净化（解除增益/减益）
    SHIELD_MASTER: 'CombatTrait.ShieldMaster', // 护盾专精（护盾构建与转化）
    BERSERKER: 'CombatTrait.Berserker', // 狂战特性（高风险高爆发）
    TACTICIAN: 'CombatTrait.Tactician', // 战术特性（节奏与条件调度）
    SIPHON: 'CombatTrait.Siphon', // 虹吸特性（多资源转移）
  },

  // 战斗场景标签：用于条件词缀设计与未来 conditional_* 规则接入
  SCENARIO: {
    ROOT: 'Scenario', // 场景命名空间根节点
    LOW_HP: 'Scenario.LowHP', // 低血场景（斩杀/保命触发）
    HIGH_HP: 'Scenario.HighHP', // 高血场景（开局压制/稳态增益）
    NO_MANA: 'Scenario.NoMana', // 空蓝场景（回蓝/减耗触发）
    FULL_MANA: 'Scenario.FullMana', // 满蓝场景（爆发起手条件）
    MANY_BUFFS: 'Scenario.ManyBuffs', // 多增益场景（增益放大/转化）
    MANY_DEBUFFS: 'Scenario.ManyDebuffs', // 多减益场景（清除/惩罚联动）
    CRIT_READY: 'Scenario.CritReady', // 暴击准备场景（暴击链触发）
    BLEEDING: 'Scenario.Bleeding', // 流血场景（DOT联动）
    CHILLED: 'Scenario.Chilled', // 冰缓场景（冰系触发）
    CURSED: 'Scenario.Cursed', // 诅咒场景（负面状态联动）
    TARGET_LOW_HP: 'Scenario.Target.LowHP', // 目标低血场景（斩杀条件词条）
    TARGET_HIGH_HP: 'Scenario.Target.HighHP', // 目标高血场景（开局压制词条）
    TARGET_LOW_MP: 'Scenario.Target.LowMP', // 目标低蓝场景（法力压制词条）
    TARGET_HIGH_MP: 'Scenario.Target.HighMP', // 目标高蓝场景（蚀元克制词条）
    CASTER_LOW_HP: 'Scenario.Caster.LowHP', // 施法者低血场景（背水反击词条）
    CASTER_LOW_MP: 'Scenario.Caster.LowMP', // 施法者低蓝场景（回蓝保命词条）
    TARGET_HAS_BURN: 'Scenario.Target.HasBurn', // 目标带灼烧标签（状态触发增伤）
    TARGET_HAS_CHILL: 'Scenario.Target.HasChill', // 目标带冰缓标签（状态触发增伤）
  },

  // 结果标签：用于产物投影阶段（Projection）标识最终产物类型
  OUTCOME: {
    ROOT: 'Outcome', // 结果命名空间根节点
    ACTIVE_SKILL: 'Outcome.ActiveSkill', // 结果为主动技能
    PASSIVE_ABILITY: 'Outcome.PassiveAbility', // 结果为被动能力
    ARTIFACT: 'Outcome.Artifact', // 结果为法宝
    GONGFA: 'Outcome.GongFa', // 结果为功法
  },
  /** Battle-side tags referenced by creation-v2 composition rules */
  BATTLE: {
    ABILITY_TYPE_DAMAGE: 'Ability.Type.Damage', // 战斗能力标签：伤害类（用于 immunity/筛选）
    ABILITY_TYPE_MAGIC: 'Ability.Type.Magic', // 战斗能力标签：法术类
    ABILITY_TYPE_PHYSICAL: 'Ability.Type.Physical', // 战斗能力标签：物理类
    ABILITY_TYPE_HEAL: 'Ability.Type.Heal', // 战斗能力标签：治疗类
    ABILITY_TYPE_CONTROL: 'Ability.Type.Control', // 战斗能力标签：控制类
    ABILITY_ELEMENT: 'Ability.Element', // 战斗能力标签：元素父标签（用于条件筛选）
    ABILITY_KIND_ARTIFACT: 'Ability.Kind.Artifact', // 能力来源：法宝
    ABILITY_KIND_GONGFA: 'Ability.Kind.GongFa', // 能力来源：功法
    BUFF_TYPE_BUFF: 'Buff.Type.Buff', // Buff 标签：正面状态
    BUFF_TYPE_DEBUFF: 'Buff.Type.Debuff', // Buff 标签：负面状态
    BUFF_TYPE_CONTROL: 'Buff.Type.Control', // Buff 标签：控制类（用于 buff 免疫/拦截）
    BUFF_DOT: 'Buff.Dot', // Buff 标签：持续伤害
    BUFF_DOT_BURN: 'Buff.Dot.Burn', // Buff 标签：灼烧 DOT
    STATUS_CONTROL: 'Status.Control', // 宿主状态：控制父标签
    STATUS_STUNNED: 'Status.Control.Stunned', // 宿主状态：眩晕
    STATUS_NO_ACTION: 'Status.Control.NoAction', // 宿主状态：禁行动
    STATUS_BURN: 'Status.Burn', // 宿主状态：灼烧
    STATUS_DOT: 'Status.DOT', // 宿主状态：持续伤害
    STATUS_CHILL: 'Status.Chill', // 宿主状态：冰缓
    STATUS_BUFF: 'Status.Buff', // 宿主状态：泛增益
    STATUS_DEBUFF: 'Status.Debuff', // 宿主状态：泛减益
    STATUS_DEF_DEBUFF: 'Status.DefDebuff', // 宿主状态：防御削弱
    STATUS_COMBO: 'Status.Combo', // 宿主状态：连击层数
    STATUS_MANA_EFF: 'Status.ManaEff', // 宿主状态：减耗
    STATUS_MYTHIC: 'Status.Mythic', // 宿主状态：神话级强化
  },
  /** Battle event types used in passive listener specs.
   *
   * These string values mirror battle-v5 CombatEvent.type literals.
   * They are defined here (rather than imported directly from battle-v5 events)
   * to keep affix definitions isolated from battle-v5 implementation details.
   * If battle-v5 renames an event, update this map and recompile — TypeScript
   * will surface every usage site automatically.
   */
  BATTLE_EVENT: {
    ACTION_PRE: 'ActionPreEvent', // 行动前事件：起手buff/准备动作
    DAMAGE_TAKEN: 'DamageTakenEvent', // 受击后事件：反伤、吸取、续命等
    DAMAGE_REQUEST: 'DamageRequestEvent', // 伤害请求事件：增减伤前置修正
    DAMAGE: 'DamageEvent', // 伤害结算事件：免疫/护盾/抵消等
    ROUND_PRE: 'RoundPreEvent', // 回合开始事件：每回合恢复、周期触发
    SKILL_CAST: 'SkillCastEvent', // 技能施放事件：施法触发链
    BUFF_ADD: 'BuffAddEvent', // Buff 添加事件：拦截/免疫/替换
  },
  /** Listener scope values used in passive listener specs.
   *
   * Mirror of battle-v5 ListenerScope type values.
   */
  LISTENER_SCOPE: {
    OWNER_AS_TARGET: 'owner_as_target', // owner 作为受击/受效目标时触发
    OWNER_AS_ACTOR: 'owner_as_actor', // owner 作为任一参与者时触发
    OWNER_AS_CASTER: 'owner_as_caster', // owner 作为施法者时触发
    GLOBAL: 'global', // 全局触发（不限定 owner 角色位）
  },
} as const;