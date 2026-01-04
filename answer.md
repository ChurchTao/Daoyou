### 1. 效果来源的优先级 (Calculation Order)

**Q: 伪代码中的 `priority` 字段是否足够？是否需要更细粒度控制？**

**A: 单靠 `priority` (int) 是不够的，且容易出错。建议引入“计算阶段 (Stage)”的概念。**

在 RPG 数值计算中，标准的公式通常是： `最终值 = (基础值 + 固定加成) * (1 + 百分比加成) + 最终修正`

如果只用 `priority` 数字（如 100, 200），开发者很难记住“加法是100还是200”。

**推荐方案：** 在 `StatModifierEffect` 中显式引入 `ModifierType`，引擎内部根据 Type 自动排序，而不是手动填数字。

```typescript
// 定义明确的计算阶段
enum StatModifierType {
  BASE = 0, // 基础值 (如：武器白字)
  FIXED = 1, // 固定值加成 (如：力量转化攻击，戒指+10攻击)
  PERCENT = 2, // 百分比加成 (如：攻击力+10%)
  FINAL = 3, // 最终修正 (如：最终伤害+50，通常用于极为特殊的词条)
}

class StatModifierEffect extends BaseEffect {
  // 构造时强制要求传入类型，而不是模糊的 priority
  constructor(
    public stat: string,
    public type: StatModifierType,
    public value: number,
  ) {
    super();
    // 自动映射到 priority，确保计算顺序永远正确：BASE -> FIXED -> PERCENT -> FINAL
    this.priority = this.type * 1000;
  }
}
```

**结论：** 废弃手动填写的 `priority`，改为业务语义更强的 `Type` 或 `Stage`。

---

### 2. 与现有 StatusRegistry 的关系

**Q: 是否保留 `StatusRegistry`？元信息（conflicts, maxStack）放哪里？**

**A: 删除 `StatusRegistry` ，以新的 `BuffConfig`为准。**

---

### 3. 技能效果的处理方式 (Migration Strategy)

**Q: 现有技能数据结构（power/effect字段）是否需要迁移到 `EffectConfig[]`？还是动态转换？**

**A: 直接删掉现有技能数据结构相关字段，不用考虑老数据的兼容性**

---

### 4. Entity 接口的统一

**Q: 新接口是在 `BattleUnit` 实现还是重构 `Cultivator`？**

**A: 在 `BattleUnit` (运行时) 上实现。`Cultivator` (持久化数据) 保持扁平。**

这是一个非常典型的 **Data (DTO) vs Model (Domain Object)** 问题。

- **Cultivator (Data)**: 它是存数据库的样子。应该是扁平的 JSON 对象，只存 ID、Level、Exp 等关键数据。**不要把复杂的 BuffManager 塞进去。**
- **BattleUnit (Model)**: 它是战斗时的对象。它实现 `Entity` 接口。

**生命周期：**

1. 战斗开始前：`new BattleUnit(cultivatorData)`。
2. 构造函数中：解析 `cultivatorData.equipments` (只有ID)，去配置表查找 Config，创建 `EquipmentInstance`，放入 `BattleUnit.equipments`。
3. 初始化 `this.buffManager = new BuffManager(this)`。

**结论：** `Entity` 接口由 `BattleUnit` 实现。`Cultivator` 只需要确保能提供构建 `BattleUnit` 所需的数据（ID列表、等级）即可。

---

### 5. 持久化存储的兼容性

**Q: 是否需要新增配置表文件？重构 DB Schema？**

**A: 必须引入“静态配置表管理”，但 DB Schema 改动很小。**

- **新增配置表 (JSON/TS)**: 是的。你之前的逻辑可能散落在代码里，现在需要集中管理 `skills.json`, `buffs.json`, `equipments.json`。这是必须付出的代价，为了后续的可维护性。
- **DB Schema**: 新增配置列，存“玩家拥有什么（配置ID）”和“当前状态（Level）”，比如在skills中，新增 `effect_config` 列,存放 `EffectConfig[]` 记录了技能的配置id和一些创建技能实例时所需的数据。

---

### 6. 重构范围确认 (Roadmap)

**Q: 第一阶段就需要完整实现 Factory 和所有效果吗？**

**A: 可以先实现Factory，效果可以先实现几个关键的，其他的可以建一个空壳，后续再补充**

---
