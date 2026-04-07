**结论**
这轮我没有改代码，只做了代码阅读、静态分布统计和一轮蒙特卡洛抽样。总体判断是：造物引擎 v2 已经具备“能跑通”的机制闭环，但还没有形成“可控的数值闭环”。根因不是某个单点参数，而是当前同一个 effectiveEnergy 同时承担了解锁类别、决定槽位、支付词缀成本、间接代表成品强度四件事。结果就是材料投入、词缀数量、词缀品质和词缀数值之间的关系还不够稳定。

- 材料输入层已经有明确约束，1 到 6 种材料、每种 1 到 3 个，见 CreationBalance.ts 和 CreationInputValidator.ts。当前单材料能量来自品质权重乘以 $ \sqrt{\text{quantity}} $，再加手册 bonus，见 MaterialTagNormalizer.ts 和 MaterialTagNormalizer.ts。多样性和语义一致性再额外加成，见 CreationBalance.ts 和 MaterialBalanceProfile.ts。这套公式比旧版本健康，但额外材料仍然过于值钱，因为每多一种材料都拿到完整品质贡献，还额外吃到 diversity bonus，没有主材和辅材层级。
- 能量预算层是当前最大的结构问题。现有阈值在 CreationBalance.ts，槽位梯次在 CreationBalance.ts。我按当前约束做了 10 万次随机抽样，不计 coherence 时总能量的 p50/p75/p90 大约是 44/65/80。也就是说，当前神话解锁阈值 44 和 5 词缀槽位阈值 44，实际上在很大一部分输入里都会被打开。更关键的是，按真实词缀成本分布，1 个 core + prefix + suffix + resonance + signature 这类 5 词缀主流组合，最低成本已经在 44 到 46，中位成本在 51 到 53，再加保留能量后会更高，所以“解锁了 5 槽”并不等于“预算足够填满 5 槽”。这会直接制造玩家体感落差。
- 词缀池和词缀数量层已经做过一轮修正，包含最小 tag hit、加权平均品质门槛、core 保底等，见 AffixPoolBuilder.ts、AffixEligibilityRules.ts 和 AffixEligibilityRules.ts。这部分方向是对的。但这里有一个实打实的平衡漏洞：AffixSelector.ts 只给部分类别生成 category cap，而 CategoryQuotaRules.ts 把没有 cap 的类别当成无限制放行，所以 synergy 和 mythic 实际上并不是严格按 targetShare 在受控分配，而是可能绕过配额自由流入。这不是参数问题，是规则语义本身有漏洞。
- 词缀定义规模已经够大，skill 84 个、artifact 69 个、gongfa 75 个。我做了静态分布统计后看到，成本梯度大致是健康的，prefix 平均 7 到 8，suffix 平均 9 到 10，resonance 约 10 到 11，signature 14 到 15，mythic 16 到 18；但高阶词缀在每条产品线里的数量仍然偏少，尤其 signature 和 mythic，导致一旦高阶类别变得常见，重复感会很快上来。
- 词缀数值层现在是“两头失衡”。一头是主动技能直伤偏低。skill core 直伤的系数大多落在 0.4 到 0.55，见 skillAffixes.ts 和 skillAffixes.ts。但 battle-v5 的伤害管线是先减防，再保底 10%，见 DamageSystem.ts。而当前回归基准单位在 BattleRegressionHarness.ts 给出的面板下，实际大概是 HP 2520、MAGIC_ATK 725、MAGIC_DEF 575、ATK 690、DEF 400，这意味着很多直伤 core 会过早塌到 10% 保底附近，伤害区分度不足。另一头是永久二级属性词缀偏猛，而且语义不统一。例如 artifact 这边的高阶暴击率和暴击伤害词缀在 artifactAffixes.ts 和 artifactAffixes.ts，gongfa 这边的暴击伤害和治疗增幅又在 gongfaAffixes.ts 和 gongfaAffixes.ts。同样是 CRIT_DAMAGE_MULT，有的用 FIXED，有的用 ADD；同样是百分比类属性，又统一用 base + quality × coefficient 的线性模式。这会让永久暴击、治疗增幅、穿透之类的收益远比主属性和扁平护盾、回血更难控。

**方案**
我建议分两层做，先热修，再改机制。按你刚才选的方向，两者一起推进是合理的。

- 第一层是最小风险热修。把解锁阈值先整体抬高到 prefix 12、suffix 20、resonance 30、signature 42、synergy 56、mythic 72；把槽位阈值改成按可支配预算而不是总预算判断，建议 2 词缀为 0 到 17，3 词缀为 18 到 31，4 词缀为 32 到 51，5 词缀为 52 以上。这样 5 槽位至少和真实 5 词缀中位成本对齐，不会再在“刚开神话”时就大量出现空槽或预算枯竭。
- 第二层是把当前单一 effectiveEnergy 拆成两个量。$U$ 只负责解锁类别和槽位，$E$ 只负责支付词缀成本。$U$ 应该更看重材料结构、语义一致性、主材品质和手册方向性；$E$ 才看总投入量。这样才能同时解决“多投几种材料就乱开高阶类别”和“开了 5 槽却装不满”这两个矛盾。
- 材料层建议改成主材和辅材模型。第 1、2 个材料给满额贡献，第 3 到 6 个材料做明显递减。一个可行的版本是按贡献排序后，用 $[1.00, 0.90, 0.75, 0.60, 0.45, 0.35]$ 乘到每个材料的能量项上。手册类材料不要再直接给原始能量加 2 或 3，而是转成对 core 权重、元素偏向、技能或功法适配的结构 bonus。这样用户投入 1 到 6 种材料时，方向性会比堆料更重要。
- 词缀数量和类别分配要从“部分 cap”改成“完整矩阵”。所有 category 都必须显式给 cap，没有被分配到配额的 category 应该是 0，而不是 undefined。建议同时增加按槽位的高阶桶限制：3 槽时 signature 及以上为 0，4 槽时 high-tier 总数最多 1，5 槽时 high-tier 总数最多 2，mythic 最多 1。这样 targetShare 才会真正落地。
- 词缀数值要按数值族分开缩放，不能继续所有东西都走同一条线性公式。扁平伤害、扁平治疗、主属性、二级百分比属性、穿透和暴击，这五类至少要拆开。我的建议是：主动技能直伤 core 把攻击系数拉到 0.85 到 1.05，或者在投影层补一个对直伤 core 生效的减防补偿；扁平护盾和每回合回血改成“扁平值 + 最大生命百分比”的混合式，不然会长期被 HP 面板甩开；永久 CRIT_RATE、CRIT_DAMAGE_MULT、HEAL_AMPLIFY、穿透统一只用 FIXED，不再允许 artifact 和 gongfa 的永久词缀对这些属性使用 ADD；高阶 percent_damage_modifier 的单词缀上限从 0.85 到 0.9 这类值降到 0.45 到 0.6，更适合多词缀叠加的系统。
- 针对 battle-v5 的真实量级，建议给每种产品设一个目标结果区间，而不是直接盯 affix 数字。比如主动技能 core 的单次有效伤害应大致落在目标基准单位最大生命的 5% 到 9%，artifact 核心防御词缀的单次护盾触发应落在最大生命的 4% 到 6%，gongfa 的每回合回血应落在 2.5% 到 4%。这样之后无论 battle-v5 面板再怎么微调，creation-v2 都有统一标尺。

**验证**
当前测试能说明“系统没坏”，但还不够说明“平衡成立”。TTKBaselineRegression.test.ts 只有每种产品 1 组材料、12 个 seed；AffixDistributionWindow.test.ts 也是人工合成池，不是全量真实词缀池。所以我建议下一轮同时补两种验证。

1. Monte Carlo 分布验证：至少 5 万次样本，输出材料输入分布、总能量、可支配预算、槽位填充率、预算浪费率、高阶词缀占比、mythic 命中率、每个 affix 的出现频次。
2. 真实 battle-v5 回归：按低、中、高三档材料组合，对 skill、artifact、gongfa 各跑 100 到 300 场，监控胜率、平均回合数、卡战率、伤害来源占比、被动触发次数。
3. 验收目标：mythic 解锁率控制在 8% 到 15%，5 槽位填满率至少 60%，budget waste 中位数低于 12%，定向投料对目标 affix 的命中率至少是随机投料的 2 倍。

如果你要我继续做，我建议直接进入这三个动作中的一个：

1. 我先给你落一版参数热修，包含新阈值、完整 category cap 矩阵和第一轮高危词缀数值回调。
2. 我先改机制，把 unlock score 和 spendable energy 拆开，同时保留兼容层，避免一次性推翻流程。
3. 我先补 Monte Carlo 和真实 battle-v5 双验证，再用跑出来的分布反推最终参数。