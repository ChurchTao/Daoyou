  ---

  1. 标签语义的“平庸化”与“重复定义” (Redundancy & Genericism)

  代码现状：
  在 CreationTags.ts 中，我看到了大量的 SEMANTIC_XXX（如 SEMANTIC_FLAME, SEMANTIC_FREEZE）。

  Review 意见：
   * 重复定义： 这些标签与 GameplayTags 中的 ABILITY.ELEMENT.FIRE 或 BUFF.ELEMENT.ICE 在语义上是高度重合的。
   * 割裂感： 开发者在造物材料上打了一个 SEMANTIC_FLAME 标签，但在战斗引擎里却要去找 ABILITY.ELEMENT.FIRE。
   * 架构风险： 这种“平行词表”会导致映射关系（Mapping
     Table）呈指数级增长。如果你新增一种“雷劫”属性，你需要在两个词表里同时更新，且必须写死它们的转换逻辑。

  ---

  2. 词条筛选逻辑的“规则膨胀” (Rule Bloat in Selection)

  代码现状：
  项目中有 AffixSelectionRuleSet 和 AffixSelectionConstraints。这说明词条（Affix/Modifier）的筛选是基于一套复杂的“规则集（Rule
  Set）”来完成的。

  Review 意见：
   * 硬编码倾向： 现有的 AffixSelector 似乎过于依赖外部规则（Rules），而不是词条自身的元数据。
   * 缺乏自描述性： 成熟的游戏架构中，词条应该是“自描述”的。例如，“寒冰箭”这个词条自己就应该声明：“我需要材料包含 Ice 或 Water
     标签”。
   * 黑盒问题： 目前的筛选逻辑散落在 RuleSet 中，导致很难通过看一个词条的定义就预判它在什么时候会被命中。

  ---

  3. 标签“单向流动”导致的产物失焦 (One-Way Flow & Missing Propagation)

  代码现状：
  目前的逻辑流似乎是：Material -> Tags -> Rules -> Affix -> Product。

  Review 意见：
   * 标签丢失： 在 Affix -> Product 的最后一步，标签的传递断了。
   * 产物能力模糊： 因为产物（Skill/Artifact）的标签是由造物引擎根据 RECIPE 或 INTENT “拍脑袋”定下来的（如
     PRODUCT_BIAS_SKILL），它并没有真正反映出产物内含词条的能力。
   * 后果：
     战斗引擎拿到的产物标签是模糊的。比如一个法宝由“火”和“电”材料做成，词条包含“火焰爆炸”和“雷电麻痹”，但如果造物引擎最后只给了它
     一个 Item.Artifact 标签，战斗引擎里的“雷系增伤”就无法作用于它。

  ---

  架构师的“专业化”重构建议

  为了解决上述问题，我建议实施以下 “三位一体” 的重构方案：

  A. 语义归一化 (Tag Unification)
   * 操作： 废弃 CreationTags.MATERIAL.SEMANTIC_XXX。
   * 建议： 材料提取层直接产出 GameplayTags。如果一个材料是“火灵草”，它的标签直接就是 Ability.Element.Fire。
   * 理由： 既然最终都要在战斗引擎里生效，为什么不从材料那一刻就使用“专业词汇”？拒绝冗余，直接对齐。

  B. 词条元数据驱动 (Metadata-Driven Matching)
   * 操作： 将 AffixSelectionRuleSet 的逻辑沉淀到词条（Affix/Modifier）的定义中。
   * 建议： 词条定义结构如下：

   1     {
   2       id: 'frost_nova',
   3       match: {
   4         all: [Ability.Element.Ice], // 必须有冰
   5         any: [Ability.Function.Damage, Ability.Function.Control], // 有伤害或控制之一
   6       },
   7       outputTags: [Ability.Element.Ice, Ability.Target.AoE] // 选中后贡献的标签
   8     }

  C. 标签溯源与自动生成 (Tag Propagation)
   * 操作： 最终产物的标签不再由“偏好”决定，而是由“构件”决定。
   * 建议： 
       1. 产物基础标签 = Intent (如 Ability.Kind.Skill)。
       2. 产物能力标签 = SelectedAffixes.map(a => a.outputTags).flat()。
       3. 产物属性标签 = Materials.map(m => m.elementTags).flat()。
       4. 汇总（Union）： 最终产物拥有上述所有标签的并集。

  ---