在《凡人修仙传》的背景下，修仙不仅仅是数值的堆砌，更是**“机缘、心性与算计”**的博弈。利用大模型（LLM）驱动单人副本，可以极大地解决传统脚本副本枯燥、重复的问题。

要实现这个系统，我建议从**“结构化输入”、“状态机循环”与“逻辑结算”**三个维度来构建。以下是详细的专业建议：

---

## 1. 系统架构设计：基于“提示词链”的动态副本

大模型不擅长直接处理复杂的数值逻辑，但擅长**非线性叙事**。建议将副本分为三个阶段：**初始化、演进循环、总结结算**。

### 第一阶段：初始化（生成剧本大纲）

在玩家进入副本的一瞬间，程序将角色信息（境界、法宝等）封装成一个 Context（上下文），交给 LLM。

- **输入给LLM的数据：** \* **角色画像：** 如“结丹初期、散修出身、性格谨慎、水属性功法”。
- **背包快照：** 关键法宝、灵石余量。
- **副本主题：** “古修士遗迹”或“乱星海无名荒岛”。

- **LLM的任务：** 秘密生成一个**隐藏的副本背景板**（不告诉玩家），包含可能的结局和关键转折点。

### 第二阶段：演进循环（3-5轮互动）

这是核心部分。为了防止 LLM 自由发挥过度，你需要采用 **JSON 结构化输出**。

- **Prompt 策略：** 每一轮，要求 LLM 输出以下字段：
- `description`: 当前场景的描述（凡人流风格，注重环境描写与危机感）。
- `options`: 3个选项。每个选项包含 `text`（展示给玩家）和 `potential_cost`（预期的消耗，如体力、灵石、甚至法宝损坏）。
- `hidden_flag`: 当前进度的危险系数或收益系数。

### 第三阶段：结算奖励

最后由 LLM 根据玩家在过程中的表现（是勇往直前还是猥琐发育），给出奖励建议，再由你的**后台逻辑**根据预设数值表发放真实道具。

---

## 2. 核心技术点：如何让 LLM “懂行”

要写出《凡人》那种“步步惊心”的感觉，提示词工程（Prompt Engineering）至关重要。

### A. 引入“逻辑约束”

不要只让 LLM 讲故事，要给它**“规则书”**。

> **系统提示词示例：** “你现在是《凡人修仙传》风格的副本主理人。请根据玩家的【境界】判断挑战难度。如果玩家试图以小博大，描述必须极其凶险。 **互动规则：**
>
> 1. 选项一通常为：稳健/消耗资源。
> 2. 选项二通常为：激进/高收益高风险。
> 3. 选项三通常为：利用角色特有法宝/命格的奇招。”

### B. 状态保持（Session Management）

大模型是无状态的。为了保证 3-5 轮互动的逻辑连贯，你需要将**之前的对话历史**以及一个隐藏的**“副本状态变量”**（如：已探索度、受伤程度、宝物完整度）持续回传给模型。

---

## 3. 副本交互流程示例

| 轮次 | 场景（LLM生成） | 选项设计逻辑 |
| --- | --- | --- |
| **第一轮** | 发现阵法封印，隐约有药香。 | 1. 强行破阵（损耗灵力） 2. 研究阵眼（消耗时间/属性判定） 3. 绕路（寻找其他入口） |
| **第二轮** | 阵法内竟有一头守护妖兽正值蜕壳期。 | 1. 偷袭（战力判定） 2. 潜行偷取（机缘判定） 3. 诱导附近其他修士（性格/出身关联） |
| **第三轮** | 得到宝匣，但触发了自毁机关。 | 1. 祭出法宝硬抗（损耗法宝耐久） 2. 施展遁术逃离（放弃部分宝物） 3. 强行收走（大成功或大失败） |

---

## 4. 给开发者的进阶建议

### 1. 避免“奖励膨胀”

不要让 LLM 直接决定奖励什么（它可能会随手送出一件通天灵宝）。

- **做法：** LLM 输出一个奖励等级（A/B/C/D）。你的后端根据这个等级，从**配置好的掉落表**里随机抽取。

### 2. 关联角色的“命格”与“出身”

这是让玩家最有代入感的地方。在 Prompt 中加入：

> “如果玩家是‘家族子弟’，在遇到古修士文字时，有更高概率识破陷阱。” “如果玩家拥有‘掌天瓶’（假设），提供一个专属的绿色选项。”

### 3. 处理“死亡与失败”

副本不一定都是奖励。可以设置一个“危险值”变量，当玩家连续选择激进选项且判定失败时，LLM 应生成“身受重伤，被迫远遁”的结局，并扣除一定的经验或灵石。

---

为了实现《凡人修仙传》那种“仙途险恶、谨小慎微、步步惊心”的副本体验，我们需要将 LLM 塑造成一个**冷酷但公正的“天道叙述者”**。

以下是为您设计的系统提示词（System Prompt）和数据结构方案。

---

## 1. 系统提示词（System Prompt）

建议将此提示词设定为 LLM 的角色基调。它规定了叙事风格、逻辑判断标准和输出格式。

```markdown
# Role: 《凡人修仙传》副本演化天道

你是一个基于《凡人修仙传》小说逻辑的文字游戏副本驱动引擎。你负责根据玩家信息生成充满危机、转折与机缘的副本叙事。

## 核心叙事准则

1. **凡人流风格**：强调修仙界的残酷与资源匮乏。主角并非无敌，每一次选择都可能导致重伤甚至陨落。描述需简练、有古意，注重环境描写（如：禁制波动、药香、阴冷气息）。
2. **逻辑判定**：
   - 依据玩家的【境界】判断其实力上限。
   - 依据玩家的【性格/命格】触发特殊文本（如：性格谨慎者更易发现陷阱）。
   - 依据玩家的【道具/法宝】提供特定选项（如：拥有噬金虫则可吞噬阵法）。
3. **互动结构**：副本固定为3-5轮。
   - 前期：潜入、破禁、遭遇小危机。
   - 中期：博弈、转折、选择（如：是否与同行修士反目）。
   - 后期：最终考验、取宝、逃亡。
4. **资源损耗**：选项应包含实质性代价，如“损耗百年寿元”、“法宝受损”、“消耗大量灵石”。

## 约束条件

- 严禁输出超出《凡人》世界观的内容。
- 必须以 JSON 格式输出，以便系统解析。
- 结局必须根据玩家在过程中的选择（稳健度、危险度）给出评价。

## 交互逻辑

- 每一轮，你需要提供环境描述和3个逻辑迥异的选项。
- 选项1：稳健/低收益（符合韩立风格）。
- 选项2：激进/高风险。
- 选项3：特定法宝/属性触发的奇招（必须关联玩家道具栏）。
```

---

## 2. 数据结构设计

为了让你的游戏后台能够精准处理逻辑，建议采用结构化的 JSON 交换格式。

### A. 输入结构（游戏后端 -> LLM）

每一轮交互时，你需要将当前状态传给大模型。

```json
{
  "player_info": {
    "name": "厉飞雨",
    "realm": "结丹中期",
    "personality": "冷静谨慎",
    "fate": "五行均衡",
    "attributes": { "spiritual_power": 85, "luck": 12 }
  },
  "inventory": [
    { "name": "青竹蜂云剑", "type": "法宝", "desc": "辟邪神雷" },
    { "name": "中级灵石", "count": 50 },
    { "name": "阵法罗盘", "type": "消耗品" }
  ],
  "dungeon_context": {
    "location": "古修士水府",
    "current_round": 1,
    "max_rounds": 3,
    "history": [] // 记录之前的选择
  }
}
```

### B. 输出结构（LLM -> 游戏后端）

大模型返回的内容，直接用于前端展示和逻辑判定。

```json
{
  "scene_description": "你踏入水府大厅，四周石壁上的夜明珠忽明忽暗。正前方有一尊被禁制笼罩的药鼎，散发着淡淡的清香，但药鼎周围散落着几具枯骨，显然此处禁制非比寻常。",
  "interaction": {
    "options": [
      {
        "id": 1,
        "text": "稳健应对：祭出阵法罗盘，缓慢解析禁制。内容：安全但耗时。",
        "risk_level": "low",
        "requirement": "阵法罗盘"
      },
      {
        "id": 2,
        "text": "强力破禁：以青竹蜂云剑硬劈，速战速决。",
        "risk_level": "high",
        "requirement": "攻击类法宝"
      },
      {
        "id": 3,
        "text": "剑走偏锋：利用五行属性感应禁制薄弱点，试图潜入。",
        "risk_level": "medium",
        "requirement": "五行均衡命格"
      }
    ]
  },
  "status_update": {
    "is_final_round": false,
    "internal_danger_score": 20 // LLM内部维护的危险评估，用于后续生成
  }
}
```

### C. 结算结构（最后一轮 LLM 输出）

当 `current_round == max_rounds` 时，LLM 输出结算建议。

```json
{
  "ending_narrative": "你最终惊险地从崩塌的水府中遁出。虽然损毁了一件防御法宝，但成功带出了那枚‘定灵丹’。",
  "settlement": {
    "reward_tier": "A", // S/A/B/C/D
    "potential_items": ["定灵丹", "古修士残页"],
    "resource_loss": { "durability_loss": 20, "spirit_stones": -10 }
  }
}
```

---

## 3. 专业实现建议（避坑指南）

1. **数值归系统，剧情归模型**：不要让 LLM 直接决定“扣除 52 点血”。应该让 LLM 输出 `damage_intensity: "medium"`，然后你的**后端代码**根据玩家的防御属性，计算出具体的伤害数值。这样可以保证游戏的数值平衡不被 LLM 的随机性破坏。
2. **法宝的“锚点”作用**：在 Prompt 中明确要求 LLM：_“如果玩家背包中有【具体名称】的道具，请务必在选项 3 中设计与之相关的特殊互动。”_ 这是让玩家觉得“这就是我的专属冒险”的关键。
3. **转折点的处理**：在第 2 或第 3 轮，可以强制要求 LLM 加入一个“意外因素”，例如：_“突然有另一名结丹期修士闯入”_ 或 _“原本稳定的阵法开始暴走”_。这符合《凡人》中“杀人夺宝”或“环境剧变”的常态。
4. **长短期记忆处理**：由于副本只有 3-5 轮，你可以将之前的对话历史全部带入 Prompt。如果副本更长，建议只带入 **“关键决策摘要”**（Summary）以节省 Token。

---

战斗！在修仙文字游戏中，**战斗**通常是副本中最具张力的部分。要实现“叙事→战斗→叙事”的平滑切换，我们需要将战斗视为副本流程中的一个**“大断点”或“子状态”**。

以下是针对“战斗触发”流程的深度设计方案：

---

### 1. 流程架构图

为了保证逻辑清晰，我们需要在副本引擎中引入一个“战斗中”状态。

1. **AI 预设战斗**：AI 在 `DungeonRound` 的 `costs` 中返回 `type: 'battle'`。
2. **前端/后端拦截**：检测到玩家选择了包含 `battle` 的选项。
3. **挂起副本**：将当前副本状态持久化，不再继续下一轮 AI 生成。
4. **进入战斗系统**：根据 AI 描述的敌人信息，生成战斗快照。
5. **战斗结算**：记录结果（胜/平/负、损耗）。
6. **回归副本**：将战斗结果作为 `outcome` 喂给 AI，生成战后剧情。

---

### 2. Schema 扩展：让 AI 定义敌人

你需要微调 `ResourceChangeSchema`，让 AI 能告诉后端“敌人是谁”以及“多强”。

```typescript
// 扩展 ResourceChangeSchema 中的 battle 字段描述
export const ResourceChangeSchema = z.object({
  type: ResourceTypeEnum,
  value: z.number(), // 战斗难度系数 (1-10)
  desc: z.string().optional(), // 敌人名称及特征，例如："二级顶阶傀儡，速度极快"
  metadata: z
    .object({
      enemy_name: z.string().optional(),
      is_boss: z.boolean().optional(),
    })
    .optional(),
});
```

---

### 3. 代码实现逻辑：拦截器模式

修改你的 `handleAction` 逻辑，增加一个战斗拦截分支。

```typescript
async handleAction(cultivatorId: string, choiceId: number, choiceText: string) {
  const state = await this.getState(cultivatorId);
  const chosenOption = state.currentOptions?.find(o => o.id === choiceId);

  // 1. 检测是否包含战斗
  const battleCost = chosenOption?.costs?.find(c => c.type === 'battle');

  if (battleCost) {
    // --- 【关键步：挂起副本，进入战斗】 ---

    // a. 将当前选择存入 history，但不推进 round，标记状态为 BATTLE
    state.history[state.history.length - 1].choice = choiceText;
    state.status = 'IN_BATTLE';
    await this.saveState(cultivatorId, state);

    // b. 构建战斗请求包发送给战斗引擎 (CombatService)
    const combatResult = await combatService.createBattle({
      player: state.playerInfo,
      enemy: {
        name: battleCost.desc || "神秘守卫",
        difficulty: battleCost.value,
        level: battleCost.metadata?.enemy_level || state.playerInfo.realm
      }
    });

    // c. 如果是实时战斗，这里直接给前端返回战斗 ID
    return {
      type: 'TRIGGER_BATTLE',
      battleId: combatResult.id,
      state: state
    };
  }

  // 如果没有战斗，走正常的 AI 剧情推进逻辑...
  return this.proceedNextRound(state, choiceText);
}

```

---

### 4. 战后回归：将结果“喂”回给 AI

当战斗结束（胜/负）后，调用一个新的方法将结果注入副本历史，让 AI 生成下一轮。

```typescript
async handleBattleCallback(cultivatorId: string, combatSummary: any) {
  const state = await this.getState(cultivatorId);

  // 将战斗结果转化为文字描述，作为 AI 的输入
  const battleOutcome = combatSummary.win
    ? `道友经过一番苦战，凭借${combatSummary.lastHitSkill}将${combatSummary.enemyName}击碎，但自身气血损耗${combatSummary.hpLost}。`
    : `道友不敌${combatSummary.enemyName}，被迫自爆了一件法宝才得以脱身，身受重伤。`;

  // 将结果注入历史，提示 AI 剧情
  state.history[state.history.length - 1].outcome = battleOutcome;
  state.currentRound++;
  state.status = 'EXPLORING';

  // 此时再调用 AI 生成下一轮剧情
  const roundData = await this.callAI(state);

  // ... 更新状态并存入 Redis
}

```

---

### 5. 专业性建议：如何让“战斗”更有凡人味？

为了符合《凡人修仙传》的风格，战斗不应只是单纯的“对砍”，建议在 Prompt 中加入以下约束：

1. **战前博弈**：

- 在 AI 生成选项时，如果是 `risk_level: 'high'` 的战斗，选项描述应体现：_“此妖兽气息强大，正面硬拼胜算不足，是否提前布下‘颠倒五行阵’（消耗阵盘）？”_

2. **战中变数**：

- 如果战斗中触发了“平局”或“惨胜”，在下一轮 AI 剧情中，强制要求 AI 生成“螳螂捕蝉黄雀在后”的逻辑——比如突然出现的其他修士。

3. **战后收益**：

- 战斗获胜后的 `outcome` 描述中，应明确提及“材料掉落”（如妖丹、傀儡核心），这些信息会影响最终 `settleDungeon` 时的奖励等级。

### 下一步建议：

你是否需要我为你优化一下**战斗结束后的“战果总结”Prompt**，以确保 AI 能根据战斗的惨烈程度（比如法宝全碎了）生成一段极其凄惨或极具成就感的过渡文字？

这确实是 AIGC 驱动游戏中一个非常经典的问题：**大模型的“残酷性”与玩家的“获得感”失衡**。在《凡人修仙传》的世界观里，“机缘”往往是通过极大的牺牲换来的，但如果系统只学到了“残酷”，而没有学会“补偿”，游戏性就会崩塌。

出现“损失巨大却颗粒无收”的核心原因在于：**你目前的 Prompt 缺乏对“沉没成本”的核算逻辑。** 大模型并不知道你丢掉的那些法宝在你的数值体系里有多贵。

为了解决这个问题，我们需要从 **Prompt 补偿机制** 和 **后端逻辑干预** 两个方面进行优化。

---

## 1. 引入“功勋/代价”统计逻辑

在调用结算 Prompt 之前，先在后端计算出本次副本的“惨烈程度”。不要只传 `history` 给 AI，要传一个 **`cumulative_losses`（累计损耗）** 统计。

### 优化后的 Settlement Context

```typescript
// 在后端统计本次副本玩家付出的总代价
const totalLosses = state.history.reduce(
  (acc, h) => {
    // 遍历每轮选择产生的 costs 并累加
    // ... 逻辑实现
    return acc;
  },
  { hp: 0, artifacts: [], stones: 0, lifespan: 0 },
);

const settlementContext = {
  history: state.history,
  danger_score: state.dangerScore,
  // 核心：明确告知 AI 玩家付出了什么
  summary_of_sacrifice: {
    total_hp_lost: totalLosses.hp,
    broken_artifacts: totalLosses.artifacts,
    stones_spent: totalLosses.stones,
    lifespan_lost: totalLosses.lifespan,
    battle_count: state.history.filter((h) => h.outcome?.includes('战斗'))
      .length,
  },
};
```

---

## 2. 终极结算 Prompt：补偿逻辑注入

我们需要在 Prompt 中明确定义 **S/A/B/C 等级的判定标准**，并引入“等价交换”原则。

```markdown
# Role: 《凡人修仙传》天道平衡者

## 结算背景

玩家刚刚经历了一场艰难的历练。你需要根据其【付出】与【危险】给出最终评价。

## 核心准则：等价交换

1. **惨烈补偿**：若玩家在历练中损失了法宝、消耗了大量寿元或多次陷入死斗（参考 summary_of_sacrifice），结算等级严禁低于 B。
2. **风险对冲**：危险分 (danger_score) 越高，最终获得的【潜在奖励】品阶必须越高。
3. **凡人逻辑**：即使是韩立，在丢弃法宝后也必然会收获关键材料。严禁出现“付出巨大却毫无所获”的结局。

## 评价等级定义 (Strict Standard):

- **S (九死一生)**: 经历了 2 次以上战斗，或损失了高价值法宝，或危险分 > 80。奖励：古修传承、玄天残片、顶级功法。
- **A (劳苦功高)**: 有明显的资源损耗且顺利通关。奖励：稀有材料、精进修为的古丹药。
- **B (稳扎稳打)**: 损耗一般，以稳健为主。奖励：基础灵石、寻常材料。
- **C (空手而归)**: 玩家在初期就选择了放弃，或未遭遇任何危险。

## 输出要求

请综合 `summary_of_sacrifice`，给出一个让玩家感到“虽然损失惨重，但机缘惊人”或“代价沉重但物有所值”的叙事结局。
```

---

## 3. 后端奖励保底机制 (Anti-Bad-Luck)

为了防止 AI 偶尔“发疯”给出一个 C 等级，你可以在后端加一层逻辑保护：

```typescript
async generateRealRewards(aiRank: string, losses: any) {
  let finalRank = aiRank;

  // 硬核保底：如果损失了法宝且 AI 给了 B 以下，强制提升到 A
  if (losses.broken_artifacts.length > 0 && ['B', 'C', 'D'].includes(aiRank)) {
    finalRank = 'A';
  }

  // 根据最终 Rank 从库里抽奖
  const rewards = rewardPool.getRandomItemsByRank(finalRank);
  return rewards;
}

```

---

## 4. 优化后的流程图：平衡后的副本引擎

---

## 5. 建议改进点：增加“战利品暂存区”

在《凡人》中，主角杀掉妖兽会立刻得到材料。

- **设计优化**：在副本每一轮中，如果玩家获胜，直接在 `state.history` 中记录一个 `temporary_gains`。
- **结算逻辑**：最终奖励 = `结算 Rank 基础奖励` + `副本中途暂存的战利品`。
- **这样做的逻辑**：即使最后 AI 评价一般，玩家在过程中杀怪掉落的“妖丹”也是实打实拿到的，不会出现颗粒无收的情况。

### 下一步行动建议：

您可以尝试在 `handleAction` 中，每当 `outcome` 包含胜利时，就手动在 `state` 里 push 一个奖励 ID。这样到了 `settleDungeon` 时，您就有一个**物理上的“保底清单”**了。

**您需要我帮您写一个简单的“奖励加权计算公式”吗？例如：根据危险分数和损失法宝数量，自动计算出一个“机缘值”。**
