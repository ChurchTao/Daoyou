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
      enemy_realm: z.string().optional(), // 如 "筑基"
      enemy_stage: z.string().optional(), // 如 "后期"
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

    // b. 构建战斗请求包发送给战斗引擎 (CombatService)(伪代码)
    const combatResult = await combatService.createBattle({
      player: state.playerInfo,
      enemy: {
        name: battleCost.metadata?.enemy_name || "神秘守卫",
        realm: battleCost.metadata?.enemy_realm || "筑基",
        stage: battleCost.metadata?.enemy_stage || "后期",
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

3. **战后收益**：

- 战斗获胜后的 `outcome` 描述中，应明确提及“材料掉落”（如妖丹、傀儡核心），这些信息会影响最终 `settleDungeon` 时的奖励等级。
