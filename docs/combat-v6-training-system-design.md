# combat-v6 新版修炼系统设计

> 状态：修炼领域方向基线（Canonical）
> 建立日期：2026-09-02
> 上位设计：[`combat-v6 梦幻式战斗体系设计稿与迁移路线图`](./combat-v6-mhxy-redesign-roadmap.md)
> 适用范围：现有炼体五轨、肉身位阶、丹药推进与 combat-v6 修炼投影

本文定义现有炼体五轨如何原位改造成 combat-v6 的“四修炼 + 生命根基”。玩家看到的五轨名称、持久字段、等级、进度、丹药方向和肉身七阶继续保留；旧战斗效果和复杂随机突破退出，combat-v6 使用新的确定性数值规则。

---

## 1. 已确认的硬约束

1. 玩家界面继续使用皮肤、筋骨、脏腑、气血、元神五轨名称，不改名为攻法、防御、法术、抗法。
2. 继续使用 `condition.tracks.bodyCultivation` 及现有五轨 key，不另建第二套修炼持久模型。
3. 五轨 `level` 和 `progress` 原值继承。
4. 继续使用现有升级阈值 `100 + 70 × 当前等级`。
5. 不允许消耗修为、灵石或其他通用货币直接增加五轨进度。
6. 首版五轨进度只通过现有 `advance_track` 消耗品路径推进，包括炼体丹和灵果。
7. 现有丹药属性和轨道目标不改名、不映射，旧丹药实例无需转换方向。
8. 丹毒、药力、品质、单轨上限和防溢出校验继续存在。
9. 肉身七阶名称和阶段展示继续保留。
10. 肉身位阶不再提供任何 v5 modifier、Buff、里程碑被动或 combat-v6 战斗被动。
11. 肉身晋升只检查人物境界和五轨总等级；满足后由玩家点击确定性提升。
12. 肉身晋升不消耗丹药、材料或货币，不存在概率、失败、保底和重复尝试。
13. 筋骨、皮肤、脏腑、元神等级分别投影为四项 v6 修炼值。
14. 气血等级投影为生命根基，只增加裸身气血和固定治疗强度。
15. 四修炼不修改六维或提前改写攻防面板，只在伤害和封禁公式中计算修炼差。
16. 道装、功法、宗门心法和经脉不能提供四项修炼等级。

---

## 2. 持久数据边界

继续使用现有结构：

```ts
interface BodyCultivationState {
  version: 1;
  realm: BodyCultivationRealm;
  tracks: {
    skin: ConditionProgressTrack;
    sinew_bone: ConditionProgressTrack;
    organs: ConditionProgressTrack;
    qi_blood: ConditionProgressTrack;
    primordial_spirit: ConditionProgressTrack;
  };
  milestones: Partial<Record<string, boolean>>;
  breakthrough?: LegacyBreakthroughState;
}

interface ConditionProgressTrack {
  level: number;
  progress: number;
}
```

新版权威事实只有：

- 当前肉身位阶 `realm`。
- 五轨等级。
- 五轨当前等级内进度。

`milestones` 和 `breakthrough` 只属于旧系统历史数据。迁移后可以保留为无效字段，也可以在独立数据迁移中清理；combat-v6 和新版炼体服务不得读取它们决定效果或晋升。

五轨派生战斗面板不写回 `condition`，只在 combat-v6 入场投影时计算。

---

## 3. 玩家展示与内部战斗映射

| 持久 key | 玩家名称 | combat-v6 内部作用 |
| --- | --- | --- |
| `sinew_bone` | 炼体·筋骨 | `attackCultivate` 攻法修炼 |
| `skin` | 炼体·皮肤 | `defenseCultivate` 防御修炼 |
| `organs` | 炼体·脏腑 | `spellCultivate` 法术修炼 |
| `primordial_spirit` | 炼体·元神 | `resistSpellCultivate` 抗法修炼 |
| `qi_blood` | 炼体·气血 | 生命根基：`maxHp`、`healPower` |

内部映射不要求修改玩家看到的轨道名称、丹药名称或药性 key。效果预览必须展示新版实际战斗作用，不能继续显示旧物攻百分比、抗暴、减伤、回蓝或濒死保护。

---

## 4. 五轨升级

### 4.1 等级内进度

继续使用现有阈值：

```text
Lv.N → Lv.N+1 所需进度
= 100 + 70 × N
```

示例：

| 当前等级 | 升到下一级所需进度 |
| ---: | ---: |
| 0 | 100 |
| 10 | 800 |
| 20 | 1,500 |
| 30 | 2,200 |
| 40 | 2,900 |
| 50 | 3,600 |
| 59 | 4,230 |

从 0 升到 60 累计需要 129,900 点轨道进度。

当一次药力跨越多个等级时，按相同阈值逐级扣除并连续升级。达到当前肉身位阶的单轨上限后，不能继续积累溢出进度。

### 4.2 唯一推进路径

首版只允许通过合法消耗品的 `advance_track` 操作增加进度：

```text
炼体丹 / 灵果
→ PillOperationExecutor
→ advance_track(body.*)
→ 丹毒、品质和上限校验
→ 增加对应五轨进度
→ 达到阈值自动升级
```

禁止新增：

- 直接修炼按钮。
- 修为换进度。
- 灵石换进度。
- 宗门贡献换进度。
- 一键消耗通用货币升到上限。
- 绕过 `ConditionService/PillOperationExecutor` 直接修改 JSON。

未来若活动、任务或其他玩法奖励炼体成长，应发放合法炼体消耗品，或使用同一受校验的 `ConditionOperation` 服务路径，不能另写一条无上限校验的进度更新逻辑。

### 4.3 丹药与灵果

现有方向保持不变：

```text
body_skin              → 皮肤
body_sinew_bone        → 筋骨
body_organs            → 脏腑
body_qi_blood          → 气血
body_primordial_spirit → 元神
```

不创建 `training_attack`、`training_defense` 等新药性 key。已有丹药实例及其 `advance_track` 操作无需迁移。

继续保留：

- 炼丹材料和配方。
- 品质对应药力。
- 丹毒增减和上限。
- 服用场景限制。
- 当前单轨上限的服用前预测。
- 药力将越过上限时拒绝服用。
- 无有效收益时拒绝消费。

---

## 5. 肉身七阶

### 5.1 位阶名称

```text
凡躯
→ 铜皮
→ 铁骨
→ 玉髓
→ 金身
→ 法身
→ 道体
```

肉身位阶是五轨养成的阶段性展示和单轨上限门槛，不是 combat-v6 的额外战斗 build。

### 5.2 位阶条件与单轨上限

| 当前位阶 | 下一位阶 | 最低人物境界 | 五轨总等级 | 晋升后的单轨上限 |
| --- | --- | --- | ---: | ---: |
| 凡躯 | 铜皮 | 炼气 | 12 | 10 |
| 铜皮 | 铁骨 | 筑基 | 30 | 15 |
| 铁骨 | 玉髓 | 金丹 | 55 | 22 |
| 玉髓 | 金身 | 元婴 | 90 | 30 |
| 金身 | 法身 | 化神 | 140 | 45 |
| 法身 | 道体 | 合体 | 220 | 60 |

凡躯初始单轨上限为 5。道体单轨上限由旧 55 调整为 60，以形成完整终点。

晋升只检查：

```text
人物境界 ≥ 下一位阶最低人物境界
且
五轨等级总和 ≥ 下一位阶总等级要求
```

删除旧的：

- 任意若干轨达到指定等级。
- 指定筋骨、皮肤、脏腑、气血或元神等级。
- 五轨最低等级要求。
- 突破材料和定向炼体丹要求。

玩家可以自由偏科；肉身位阶只关心总投入和人物境界。

### 5.3 确定性晋升

满足条件后：

```text
点击“提升位阶”
→ 服务端事务内重新校验条件
→ realm 更新为下一位阶
→ 清除旧突破临时状态
→ 解锁新的单轨上限
```

晋升：

- 不消耗材料、丹药、修为、灵石或贡献。
- 不生成随机数。
- 不会失败。
- 不增加保底进度。
- 每次只提升一个位阶。

如果旧数据已经同时满足多个后续位阶，可以连续点击逐阶提升，但不能一次跳过中间位阶。

### 5.4 位阶不提供战斗效果

以下旧效果全部退出 combat-v6：

- 铜皮开局直接伤害减免。
- 铁骨暴击率和暴击伤害。
- 玉髓濒死保护和负面驱散。
- 金身燃血爆发和恢复。
- 法身开局控制抗性。
- 道体最终伤害减免。
- 其他旧 `milestone`、Buff、Hook 和 modifier。

位阶本身不进入 `Attrs`，不授予被动或单位标签。它只控制养成展示和单轨上限。

---

## 6. 四修炼投影

```text
attackCultivate
= floor(sinew_bone.level)

defenseCultivate
= floor(skin.level)

spellCultivate
= floor(organs.level)

resistSpellCultivate
= floor(primordial_spirit.level)
```

四项值必须为 0～60 的有限整数。迁移异常数据高于当前位阶上限时原值保留，但无法继续升级；投影仍按全局最大值 60 夹取并输出迁移诊断。

四修炼不改变：

- 永久六维和有效六维。
- `physicalAtk/physicalDef/magicAtk/magicDef` 面板。
- 暴击率、狂暴率。
- 固定伤害、伤势和治疗强度。

---

## 7. 物理与法术修炼差

### 7.1 通用公式

```text
effectiveDiff = clamp(进攻修炼 - 防守修炼, -20, 20)

applyCultivate(baseDamage, effectiveDiff)
= baseDamage × (1 + effectiveDiff × 0.02)
+ effectiveDiff × 5
```

最终向下取整，伤害最低为 1。

### 7.2 物理伤害

```text
进攻修炼 = source.attackCultivate
防守修炼 = target.defenseCultivate
```

修炼差在物理攻防基础伤害、技能系数和固定 `power` 组合完成后应用。物理狂暴仍按 rules-daoyou 的顺序先放大攻击，再进入物理防御公式。

### 7.3 法术伤害

```text
进攻修炼 = source.spellCultivate
防守修炼 = target.resistSpellCultivate
```

修炼差在法伤、法防、师门项和分灵完成后应用。

### 7.4 数值样例

基础伤害为 500 时：

| 修炼差 | 最终伤害 |
| ---: | ---: |
| -20 | 200 |
| -10 | 350 |
| -5 | 425 |
| 0 | 500 |
| +5 | 575 |
| +10 | 650 |
| +20 | 800 |

单轨等级可以达到 60，但单次伤害只计算 `-20～20` 的有效差，避免迁移角色之间出现完全无法造成伤害的极端断层。

### 7.5 默认不吃四修炼的效果

- `fixed/judge` 固定伤害。
- 中毒和普通持续伤害。
- 伤势。
- 反震。
- 直接扣血、扣蓝。
- 治疗和护盾。

个别内容若需要与修炼联动，必须在所属公式族或技能定义中显式声明并版本化，不能隐式套用物法修炼差。

---

## 8. 封禁修炼差

```text
effectiveSealDiff
= clamp(
    source.spellCultivate - target.resistSpellCultivate,
    -10,
    10
  )

sealCultivateModifier
= effectiveSealDiff × 2 个百分点
```

封禁公式继续组合：

```text
技能封禁底率
+ 技能等级与目标人物等级差
+ 修炼差修正
+ sealHit/sealResist 点数差
```

修炼差最多改变 `±20` 个百分点，最终封禁成功率继续夹在 rules-daoyou 的 `20%～90%` 范围。

固定伤害宗门不因法术修炼自动提高固定伤害；控制技能仍可通过法术修炼差提高封禁成功率。

---

## 9. 生命根基

```text
lifeFoundationLevel = floor(qi_blood.level)
```

生命根基在 `character_panel_v1` 裸身面板之后提供：

```text
maxHpBonus
= floor(characterPanelV1MaxHp × lifeFoundationLevel × 0.005)

healPowerBonus
= floor(lifeFoundationLevel / 2)
```

| 气血等级 | 裸身气血加成 | 治疗强度加成 |
| ---: | ---: | ---: |
| 10 | +5% | +5 |
| 20 | +10% | +10 |
| 30 | +15% | +15 |
| 40 | +20% | +20 |
| 50 | +25% | +25 |
| 60 | +30% | +30 |

只放大 `character_panel_v1` 根据有效六维生成的裸身 `maxHp`。不放大道装器胚、灵纹、心法、经脉和其他 build 的固定气血，避免跨系统递归乘算。

计算顺序：

```text
有效六维
→ character_panel_v1 裸身 maxHp/healPower
→ 生命根基气血百分比和固定治疗强度
→ 道装及其他 build 的最终面板贡献
```

生命根基不参与四修炼差，不修改永久六维，也不提供百分比治疗增幅。

---

## 10. 迁移

### 10.1 无需转换的事实

原值保留：

- `bodyCultivation.realm`。
- 五轨 key。
- 五轨 `level`。
- 五轨 `progress`。
- 炼体丹和灵果的 `advance_track` 方向。
- 丹毒和消耗品服用规则。

因为升级阈值未改变，不需要进度比例换算。

### 10.2 停止读取的旧数据

- `milestones` 的战斗效果。
- `breakthrough.targetRealm`。
- `breakthrough.progress`。
- `breakthrough.failedAttempts`。
- 旧肉身阶位 Buff、Hook、modifier。

迁移可以清空 `breakthrough`；重复执行必须幂等。玩家当前肉身位阶不重新计算、不降级。

### 10.3 已满足下一位阶

迁移后如果人物境界和五轨总等级已经满足下一位阶，界面显示“可提升”。玩家点击后逐阶确定性晋升，不在登录时自动越级。

### 10.4 异常越级数据

如果某轨等级高于当前位阶上限：

- 不截断、不返还、不降低等级。
- 暂停该轨继续获得进度。
- 玩家提升肉身位阶后恢复正常。
- combat-v6 投影最多读取到全局上限 60，并记录诊断。

---

## 11. 服务与事务边界

五轨进度更新继续通过现有 condition 服务链路：

```text
背包消耗品
→ PillOperationExecutor
→ ConditionOperation.advance_track
→ 单轨上限预检
→ 丹毒和服用规则
→ 更新 condition
→ 同一事务扣除消耗品
```

肉身位阶提升必须由独立服务操作：

```text
读取并锁定角色 condition
→ 规范化 bodyCultivation
→ 校验下一位阶、人物境界、五轨总等级
→ realm 前进一阶
→ 清理旧 breakthrough
→ 写回 condition
```

前端只展示预览和提交意图，不自行判断权威晋升结果。服务端不得信任客户端提交的目标位阶或总等级。

---

## 12. 实现验收条件

1. 现有角色五轨名称、key、等级和进度迁移前后完全一致。
2. 现有炼体丹和灵果无需改写方向即可继续推进对应五轨。
3. 项目不存在消耗修为、灵石或贡献直接增加五轨进度的入口。
4. 五轨继续使用 `100 + 70 × level` 阈值，并正确处理一次跨多级药力。
5. 所有进度更新经过 condition 操作和单轨上限预检。
6. 肉身七阶名称和当前位阶保持不变。
7. 位阶提升只检查人物境界和五轨总等级，点击后必定成功且无消耗。
8. 旧突破材料、概率、失败、保底和专项轨道条件不再参与晋升。
9. 肉身位阶和旧 milestones 不产生 combat-v6 战斗效果。
10. 四轨等级一对一生成四修炼字段，气血等级生成生命根基。
11. 伤害修炼差、封禁修炼差和生命根基样例与本文一致。
12. combat-v6 不读取旧 body cultivation modifier、Buff 或 Hook。
13. 重复执行迁移不会改变五轨等级、进度或重复提升位阶。

---

## 13. 后续平衡项

本文不修改现有：

- 炼丹品质到实际药力的数值表。
- 丹毒生成和清除速度。
- 炼体丹配方、材料和市场产出。
- 灵果的掉落与种植效率。

这些经济参数需要在 combat-v6 实装后根据 0～60 总进度节奏单独验证，但调整时不能新增直接点修入口或破坏既有消耗品服务边界。

