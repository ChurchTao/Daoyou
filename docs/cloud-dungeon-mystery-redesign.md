# 云游探秘重构：剧本杀式解谜副本设计

状态：设计已确认（2026-11-02），第 15 节各项按“建议默认”拍板；P0 原型实施中，进度见第 17 节。

## 1. 一句话

开局为玩家生成一份**有确定真相的案卷**，玩家以剧中角色身份进入地图节点场景，通过移动、搜查、对话、出示证据、使用物品和战斗逼近真相，最后结案推理；**评分由规则计算**，按评分发放奖励。LLM 负责“把案卷写活”和“演 NPC”，不负责“决定发生了什么”或“决定给多少”。

## 2. 现状梳理

### 2.1 当前流程

| 环节 | 实现 | 入口 |
| --- | --- | --- |
| 入口 | 31 个带 `dungeon_config` 的卫星节点；节点只有名称、标签、一句描述和难度档 | `packages/game-content/src/world/data/map.json` |
| 入场 | 预扣气（`dungeon_start`），同一角色仅一个活动副本，副本期间占用构筑 | `DungeonFlowService.startDungeonUnlocked`、`dungeon/occupancy.ts` |
| 每轮 | 固定 `maxRounds: 5`；每轮一次 LLM 调用，生成 350–650 字正文和 3 个选项（顺序固定为低/高/中风险）；代价分资源、材料、气血法力、战斗四类，LLM 只给 `rank`，数值由 `calculateDungeon*Cost` 计算 | `DungeonRoundGenerator.ts`、`prompts/dungeon-round.md`、`game-rules/dungeon/costPolicy.ts` |
| 选择 | 扣除代价 → 有战斗则进入 V6 战斗 → 搜刮（继续/离开）→ 再调用 LLM 生成下一轮 | `DungeonFlowService.handleAction`、`combatV6.ts` |
| 收益 | 探索、战斗、通关的物品和经验由种子与配置确定（`v6Rewards`）；通关基础资源由 `RewardFactory` 按 **LLM 给出的 S–D 评级**计算 | `rewards.ts`、`reward/RewardFactory.ts`、`DungeonSettlementGenerator.ts` |
| 持久化 | `wanjiedaoyou_dungeon_runs` 是权威运行态，Redis 只缓存；代价与收益用账本防重；历史写入 `dungeon_histories` | `DungeonRunStore.ts`、`schema.ts` |
| 前端 | 场景状态包括 `map_selection / exploring / battle_preparation / in_battle / looting / settlement` | `apps/web/src/routes/game/dungeon/**` |

### 2.2 问题与根因

| 玩家感受 | 根因 |
| --- | --- |
| 慢 | 每一步都要等一次完整的长文本加结构化 JSON 生成，不存在不经过 LLM 就能完成的操作 |
| 读了没用，不看字直接选 | 没有隐藏真相，也没有需要解答的问题；LLM 每轮凭最近 4 轮历史即兴编写，文本里的信息不影响结果 |
| 选项可预测 | 风险顺序固定，选项本质是代价菜单，最优解很快被摸透 |
| 没有空间感 | 5 轮线性推进，不能回头，也不能自选去哪里、查什么 |
| 不知道怎么拿高分 | 评级由 LLM 凭印象给出，和玩家行为之间没有可解释的关系 |

结论：问题出在结构上，不在文笔。只优化 prompt 无法解决。

## 3. 目标与非目标

**目标**

1. 阅读文本能带来收益：信息直接决定结案正确率和评分。
2. 玩家能主动做选择：自选地点、对象、提问内容和出示的证据，不再是三选一。
3. 大部分操作即时响应；只有 NPC 对话和自由行动需要 LLM，并且流式输出、篇幅短。
4. 评分可解释、可复现，奖励完全由服务端规则决定。
5. 地图节点通过配置扩展剧本，内容生产可持续。

**非目标（首版）**

- 多人同局、玩家之间互相扮演角色。
- 完全由 LLM 自由生成谜题结构（见 5.1）。
- 新增战斗机制；战斗沿用 V6。
- 改动气的经济体系、背包或掉落底座。

## 4. 核心概念

| 概念 | 说明 | 谁可见 |
| --- | --- | --- |
| 剧本模板 Scenario Template | 人工编写的谜题骨架：类型、规模、结案问题、评分细则、可插入的槽位 | 仅服务端 |
| 案卷 Case File | 开局由 LLM 按模板填充、经规则校验后的完整隐藏真相 | 仅服务端 |
| 角色本 Role Brief | 从案卷中投影出的玩家身份、目的、已知关系和开场背景 | 玩家 |
| 运行态 Run State | 位置、已获线索、局内物品、NPC 态度、剧情标记、行动力、对话记录 | 服务端权威，玩家只看到投影 |
| 笔记本 Notebook | 已获线索、证词、人物关系的自动归档，是运行态的玩家投影 | 玩家 |
| 结案 Deduction | 回答模板定义的结案问题 | 玩家提交，规则评分 |

真相与叙事分离：**案卷在开局时一次性确定**，运行时的一切反馈都只是“揭示案卷的一部分”，或者“按白名单改变运行态”。

## 5. 内容配置

### 5.1 为什么要人工编写骨架

纯 LLM 生成的谜题常见问题：关键线索放不下来、获取条件形成循环、真相与线索矛盾、难度失控。所以骨架（谜题结构、结案问题、评分细则）由人工编写，LLM 只填充人物、地点、物件和文字。这样既有可玩性的下限，又保留了每局的新鲜感。

### 5.2 剧本模板（`game-content`，新增）

建议位置：`packages/game-content/src/dungeon/scenarios/*.json`，配套 Zod 校验，并通过 `game-content/authoring` 的内容校验测试。

```jsonc
{
  "id": "inheritance_murder",
  "name": "遗府疑案",
  "archetype": "whodunit", // whodunit | unlock | retrieval | allegiance
  "fits_tags": ["坐化遗骸", "古修士洞府", "宗门"],
  "scale": {
    "rooms": [4, 6],
    "npcs": [2, 4],
    "key_clues": [4, 6], // 结案所需的关键线索
    "red_herrings": [1, 3], // 误导线索
    "action_budget": 24, // 行动力，见 7.2
  },
  "roles": [
    // 角色槽位，LLM 负责命名和赋予性格
    { "slot": "culprit", "count": 1, "lies": true },
    { "slot": "witness", "count": [1, 2] },
    { "slot": "heir", "count": [0, 1] },
  ],
  "questions": [
    // 结案问题，答案类型决定判分方式
    { "id": "who", "prompt": "谁是凶手", "answer_kind": "npc" },
    { "id": "how", "prompt": "用了什么手段", "answer_kind": "clue" },
    { "id": "seal", "prompt": "禁制应交给谁开启", "answer_kind": "npc" },
  ],
  "combat_slots": [
    // 可插入的战斗位置，敌人等级由节点难度决定
    { "id": "guardian", "trigger": "enter_room", "optional": true },
    { "id": "culprit_exposed", "trigger": "accuse_correct", "boss": true },
  ],
  "endings": ["truth_revealed", "culprit_escaped", "wrong_accusation"],
  "scoring": {
    "truth": 50,
    "coverage": 15,
    "efficiency": 15,
    "branch": 10,
    "combat": 10,
  },
}
```

首版建议写 3–5 个模板，覆盖四种原型：

- **whodunit**：找出真凶及作案手段。
- **unlock**：凑齐条件，开启封印或机关。
- **retrieval**：推断遗宝或失物的下落。
- **allegiance**：在两派之间看清真相，选择立场。

### 5.3 地图节点配置增强

在现有 `dungeon_config` 上扩展，原字段保持不变：

```jsonc
"dungeon_config": {
  "difficulty": "normal",
  "scenario": {
    "templates": ["inheritance_murder", "sealed_formation"],  // 可抽取的模板
    "setting": "瀑布后的古修士洞府，禁制残破",                    // 场景基调，喂给生成
    "factions": ["散修", "古修士后人"],
    "fixed_npcs": [],                   // 可选：节点固定出场的人物，用于跨局世界观
    "forbidden": ["现代器物"]           // 生成禁忌
  }
}
```

没有配置 `scenario` 的节点，按 `tags` 匹配模板的 `fits_tags` 兜底，保证 31 个节点首版都能开局。

## 6. 案卷生成与校验

### 6.1 案卷结构（`game-domain/dungeon`，新增）

```ts
interface CaseFile {
  templateId: string;
  truth: string; // 真相全文，仅用于生成 NPC 回复和结局叙事
  brief: RoleBrief; // 玩家角色本
  rooms: Room[]; // id、名称、描写、相邻房间、物件、进入条件
  objects: CaseObject[]; // id、所在房间、简述、细看描写、可交互动作
  clues: Clue[]; // id、名称、正文、是否关键、能证明什么、获取方式
  npcs: NpcCard[]; // 见 8.1
  items: RunItem[]; // 局内物品（钥匙、残页、符箓），不进背包
  interactions: Interaction[]; // (动作, 物品?, 目标) → 效果[]，效果来自白名单
  encounters: Encounter[]; // 对应模板 combat_slots，敌人参数由规则校准
  answers: Record<string, string>; // 结案问题标准答案（npc id / clue id / 选项 id）
  endings: Ending[]; // 结局条件与结局基调
}

type ClueSource =
  | { kind: 'search'; objectId: string; requires?: Condition }
  | { kind: 'dialogue'; npcId: string; requires: Condition }
  | { kind: 'interaction'; interactionId: string };

type Effect =
  // 白名单，运行时唯一能改变状态的方式
  | { kind: 'reveal_clue'; clueId: string }
  | { kind: 'grant_item'; itemId: string }
  | { kind: 'consume_item'; itemId: string }
  | { kind: 'unlock_room'; roomId: string }
  | { kind: 'set_flag'; flag: string }
  | { kind: 'npc_attitude'; npcId: string; delta: number }
  | { kind: 'start_encounter'; encounterId: string }
  | { kind: 'spend_action'; amount: number };
```

`Condition` 由 `has_clue / has_item / flag / attitude_gte / room_visited` 组合而成，只允许 `all / any` 两层嵌套。

### 6.2 生成流程

1. **选择模板**：从节点的 `scenario.templates` 中按种子抽取，种子写入运行态。
2. **LLM 填充**（一次调用）：输入模板、节点场景基调、玩家简况（境界、性格、背景，用于角色本贴合）、节点难度；输出 `CaseFile` 的 LLM 子 schema。所有 id 由 LLM 给出短名，服务端重新编号。
3. **规则校准**（确定性逻辑）：敌人境界阶段按 `resolveDungeonMapConfig` 截断（复用 `clampDungeonEnemyRealmStage`），行动力取模板值，删除越界字段。
4. **可解性校验**（`game-rules`，纯函数，带单元测试）：
   - 结构：房间连通，物件、线索、NPC 的引用全部存在，数量在模板范围内。
   - 可达性：从初始状态出发，按条件图做不动点推演，所有关键线索都能获得，所有结案标准答案都有至少一条关键线索支撑。
   - 无循环：线索获取条件之间不存在互相依赖。
   - 预算：估算的最短通关行动数 ≤ 预算 × 0.75，确保有容错空间（估算会把每个相关物件、人物和交互各计一次，偏保守）。
   - 安全：文本通过现有文本过滤，不得出现节点的 `forbidden` 内容。
5. 校验失败则把错误摘要交给 LLM 修正一次；仍然失败就从**案卷池**取一份备用，池子为空时回退到该模板的手写保底案卷。

### 6.3 案卷池（解决开局等待）

- 定时任务按“节点 × 模板 × 境界”维持每个组合 N 份（建议 3 份）已校验的案卷，存入新表 `wanjiedaoyou_dungeon_case_pool`。
- 案卷中与玩家相关的部分（角色本里的称呼、动机贴合）留占位符，开局时用确定性逻辑替换，所以池子可以复用。
- 每份案卷只发给同一角色一次，避免重复游玩背答案。
- 冷启动或池子耗尽时实时生成；生成期间先展示节点介绍和入场须知（见 10.1），掩盖等待时间。

## 7. 运行时模型

### 7.1 运行态

```ts
interface MysteryRunState {
  runId: string;
  caseRef: { poolId?: string; seed: number };
  location: string; // 当前房间
  visitedRooms: string[];
  searchedObjects: string[];
  clues: string[]; // 已获线索 id
  items: string[]; // 持有的局内物品
  flags: string[];
  npcAttitude: Record<string, number>; // -100..100
  dialogue: Record<string, DialogueTurn[]>; // 每个 NPC 保留最近 K 轮，更早的压缩为摘要
  actionsLeft: number;
  encounterResults: Record<string, 'won' | 'lost' | 'fled' | 'avoided'>;
  phase:
    | 'briefing'
    | 'investigating'
    | 'in_battle'
    | 'deducing'
    | 'settling'
    | 'finished';
}
```

案卷与运行态一起存入 `dungeon_runs.run_state`（沿用权威表）；案卷体积较大时拆到 `case_snapshot` 列。Redis 仍然只做缓存。

### 7.2 行动力

- 移动 1、搜查物件 1、对话每轮 1、使用物品 1、细看已搜过的物件 0、翻阅笔记本 0。
- 行动力耗尽后强制进入结案，没收集到的线索就此作罢。
- 作用：让盲点乱试变得有代价，同时给评分提供“效率”维度。
- 行动力不消耗气血、灵石等真实资源；真实资源只在入场（气）和战斗中消耗。这是对旧版“选项扣资源”的有意删除，目的是让玩家敢于探索。

### 7.3 交互动作

| 动作 | 请求 | 处理 | LLM |
| --- | --- | --- | --- |
| `move` | 目标房间 id | 检查相邻关系和进入条件，返回房间描写和物件列表 | 否 |
| `search` | 物件 id | 返回细看描写；满足条件时获得线索或物品 | 否 |
| `use` | 物品 id + 目标（物件或 NPC） | 查交互表，命中则执行效果；未命中返回模板化的“无事发生”文案 | 否 |
| `talk` | NPC id + 自由文本（限 80 字） | 见 8.1 | 是，流式 |
| `present` | NPC id + 线索或物品 id | 先查 NPC 卡上的 `reactions`，命中则执行确定性效果，再由 LLM 写台词 | 是，流式 |
| `attempt` | 自由文本（限 60 字） | 见 8.2，首版可不开放 | 是 |
| `fight` | 遭遇 id | 进入 V6 战斗，结果写回 `encounterResults` 和标记 | 否 |
| `deduce` | 结案问题的答案 | 规则判分，见 9 | 否 |

所有动作带 `actionId` 做幂等处理（沿用现有 `pendingAction` 和账本思路），并带 `version` 做乐观锁。

## 8. LLM 在运行时的职责

### 8.1 NPC 对话

**NPC 卡**（案卷的一部分）：

```ts
interface NpcCard {
  id: string;
  name: string;
  role: string; // 角色槽位
  persona: string; // 性格、口吻、说话习惯
  publicStance: string; // 对外说法
  knows: string[]; // 知道的事实（自然语言）
  secrets: { clueId: string; revealWhen: Condition }[];
  lies: { topic: string; claim: string; contradictedBy: string[] }[];
  reactions: {
    trigger: { present: string };
    effects: Effect[];
    hint: string;
  }[];
}
```

**每轮流程**：

1. 服务端算出这一轮**允许透露的线索集合** = 该 NPC 的 `secrets` 中 `revealWhen` 已满足的部分。
2. LLM 输入：NPC 卡（去掉 `revealWhen` 的具体条件）、允许透露的线索、玩家已出示的证据、最近 K 轮对话、玩家本轮发言。
3. LLM 输出：`{ reply: string(≤180 字), reveal: clueId[], attitudeDelta: -10..10 }`。回复文本流式下发。
4. 服务端裁剪：`reveal` 只保留允许集合内的 id，`attitudeDelta` 截断到范围内。

所以玩家无法靠话术诱导 LLM 泄露未解锁的线索，最多只能让 NPC 态度略有变化。

**说谎与戳穿**：NPC 会按 `lies` 坚持错误的说法；玩家 `present` 了 `contradictedBy` 中的线索时，`reactions` 确定性地触发“破绽”效果（设置标记、可能解锁新的秘密），LLM 只负责把 NPC 的慌乱写出来。这是本玩法的高光时刻，UI 上需要强化表现。

### 8.2 自由尝试（可选）

玩家写“用火符烧掉藤蔓”。LLM 作为裁判，从**当前房间可用的交互**中选择一个匹配项或判定无效，输出 `{ interactionId | null, narration }`，服务端只执行被选中交互的白名单效果。首版建议不开放，先观察 `use` 能否覆盖大部分需求。

### 8.3 叙事润色

房间和物件的描写在生成案卷时已经写好，运行时不再调用 LLM。结局叙事在结算时调用一次，输入是真相、玩家答案和关键事件，只写文字，不给评级。

### 8.4 Prompt 与调用

- 新增 prompt：`dungeon-case.md`（生成案卷）、`dungeon-npc.md`（对话）、`dungeon-epilogue.md`（结局）；可选 `dungeon-attempt.md`。
- 统一走 `apps/api/src/utils/aiClient.ts`；流式对话使用 `streamAiText`，结构化部分（`reveal`、`attitudeDelta`）放在流结束后的尾部 JSON 中，或改为“先结构化、后流式”两段输出，实施时二选一，以首字延迟为准。
- 记录 `sceneId` 指标，接入现有 LLM 指标后台。

## 9. 结案与评分

### 9.1 结案

- 玩家随时可以主动结案；行动力耗尽时强制结案。
- 每个结案问题按 `answer_kind` 作答：选择 NPC、选择已获得的线索、选择预设选项。**只能从已经获得的线索中选择**，所以没找到线索就答不出“手段”。
- 结案可能触发战斗（如 `culprit_exposed`），战斗结果影响结局分支。

### 9.2 评分（`game-rules`，纯函数）

```
truth      = Σ 答对的结案问题权重              （模板 scoring.truth 分配）
coverage   = 已获关键线索数 / 关键线索总数      × scoring.coverage
efficiency = clamp(剩余行动力 / 预算 × 2, 0, 1) × scoring.efficiency
branch     = 达成的结局分支加分（救下 NPC、识破全部谎言等，模板定义）
combat     = 战斗结果：胜 1 / 避战（凭线索绕开）1 / 逃 0.3 / 败 0   × scoring.combat
总分 0–100 → S ≥ 90，A ≥ 75，B ≥ 60，C ≥ 40，其余为 D
```

- 评分明细完整展示给玩家（“真相 40/50，漏了 1 条关键线索……”），让玩家知道下次怎么改进。
- 中途放弃：按已获线索计算 coverage，truth 记 0，最高 D。

### 9.3 奖励

- **沿用现有底座**：`resolveDungeonReward` 的种子掉落、`RewardFactory.generateBaseRewards`、难度系数、背包发放、账本防重全部保留。
- **唯一的改变**：`RewardFactory` 的评级输入从“LLM 评级”换成“规则评分”。
- 探索掉落的时机从“每轮”改为“获得关键线索 / 开启特定物件时”，掉落键形如 `clue:<id>`，仍由种子和配置确定。
- 战斗掉落沿用 `battle:<id>`。

## 10. 前端体验

### 10.1 场景结构

遵循 `daoyou-game-ui` 的身份层 / 任务层 / 导航层分离：

| 阶段 | 内容 |
| --- | --- |
| 入场（briefing） | 角色本：身份、目的、人物关系图、开场一幕。底部按钮“入局” |
| 调查（investigating） | 主区：当前房间描写与可交互物件；侧栏或抽屉：房间地图、在场 NPC、笔记本；顶部：行动力 |
| 对话 | 对话面板：自由输入框 + “出示”按钮（打开笔记本选择证据）；回复逐字流式显示 |
| 战斗 | 复用 `CombatV6Layout` |
| 结案（deducing） | 逐题作答，答案从笔记本中选取 |
| 结算 | 结局叙事 + 评分明细 + 奖励 |

### 10.2 降低阅读负担但保留阅读价值

- 单次反馈控制在 200 字以内；长信息拆进笔记本，按需查看。
- 线索在笔记本中自动标注“可能相关的人物”，但不标注“是否关键”。
- 已搜查过的物件置灰；没有可交互内容的房间显示“已查尽”，减少无效点击。
- 第一次使用某个动作时给出一行提示，不做强制教程。

## 11. 架构落点

| 内容 | 位置 |
| --- | --- |
| 案卷、运行态、动作、效果等领域类型 | `packages/game-domain/src/dungeon/mystery/*` |
| 条件求值、效果执行、可解性校验、评分 | `packages/game-rules/src/dungeon/mystery/*`（附单元测试） |
| 剧本模板与保底案卷 | `packages/game-content/src/dungeon/scenarios/*` |
| 请求与响应契约、玩家投影 | `packages/contracts/src/dungeonMystery.ts` |
| 编排（开局、动作、对话、结案、结算） | `apps/api/src/dungeon/application/mystery/*`，挂在现有 `DungeonModule` 下 |
| Prompt | `apps/api/src/prompts/dungeon-case.md` 等 |
| 案卷池表、`dungeon_runs` 新列 | `schema.ts` + `drizzle/` 迁移 |
| 前端 | `apps/web/src/routes/game/dungeon/**` 新场景组件，`lib/hooks/dungeon` 新 hook |

**复用**：`DungeonRunStore`、occupancy 占用、气的预扣与提交、`combatV6.ts` 的战斗接入、奖励与账本、恢复（recover）机制、`dungeon_histories`。

**API 草案**（沿用 `dungeon.controller.ts` 风格，`AccessGuard` + Zod pipe）：

```
POST /api/dungeon/start            { mapNodeId }            → 角色本 + 初始投影
GET  /api/dungeon/state                                      → 玩家投影
POST /api/dungeon/act              { actionId, version, action } → 投影增量
POST /api/dungeon/talk             { actionId, version, npcId, text | presentId } → 流式（SSE）
POST /api/dungeon/deduce           { actionId, version, answers } → 评分 + 结局
POST /api/dungeon/recover | quit                             （沿用）
```

**安全要点**：

- 玩家投影只包含已揭示的内容；`truth`、`answers`、未获得的线索永远不下发。
- 自由文本做长度限制，经过现有文本过滤，并作为“数据”传给 LLM，prompt 中声明其不是指令。
- 对话设置频率限制，每局对话轮数设上限（由行动力天然限制）。

## 12. 性能预期

| 操作 | 旧版 | 新版 |
| --- | --- | --- |
| 开局 | 1 次长生成 | 从池中取出，即时；冷启动 1 次案卷生成，用 briefing 掩盖等待 |
| 移动、搜查、使用物品 | 每步都要 1 次长生成 | 即时，无 LLM |
| 对话 | 无 | 1 次短生成，流式，首字目标 < 1.5 秒 |
| 结算 | 1 次生成 | 评分即时；结局叙事 1 次短生成，可以先展示评分再流入叙事 |

单局 LLM 调用次数预计会比旧版的 6 次更多（主要来自对话），但每次输出更短，并且玩家可以选择少对话。案卷池把最重的一次调用移到了离线。

## 13. 旧版退役

- 新旧版本以节点为粒度切换：配置了 `scenario` 的节点走新流程，其余仍走旧流程，直到全部节点迁移完毕。
- 迁移完成后删除 `DungeonRoundGenerator`、`dungeon-round.md`、选项代价链路（`costs.ts` 中仅供选项使用的部分）、`DungeonMaterialSubmission` 等不再被引用的代码；先确认奖励、恢复路径没有残留调用方。
- 发布时处理活动中的旧副本：允许跑完，或在维护期间按现有 `safe_retreat` 规则结算。

## 14. 分期

| 阶段 | 内容 | 验证 |
| --- | --- | --- |
| P0 原型 | 1 个模板（whodunit）+ 1 个节点；案卷生成与校验；`move/search/use/deduce`；规则评分；接入现有奖励；最简 UI | 本地完整跑通 3 局；校验器单元测试；人工评估“不读文本是否会显著降低评分” |
| P1 对话 | NPC 对话流式、`present` 与戳穿谎言、态度；战斗槽位接入 | 越权诱导测试（话术索取未解锁线索）；对话首字延迟；战斗中断恢复 |
| P2 规模化 | 案卷池与定时任务；补齐 3–5 个模板；按标签兜底覆盖全部 31 个节点；后台案卷预览与校验工具 | 池子补充与消费；同一角色不会拿到重复案卷 |
| P3 退役 | 全部节点切换，删除旧链路 | 无残留调用；发布说明 |

每个阶段的验收都按 `AGENTS.md`：纯规则写单元测试，前后端用 lint/build 加本地真实接口与浏览器验证，并记录已验证和未验证项。

## 15. 已拍板事项

2026-11-02 确认全部采用下表“结论”列。

| # | 问题 | 选项 | 结论 |
| --- | --- | --- | --- |
| 1 | 单局时长 | 10 分钟轻量 / 20–30 分钟完整 | 15 分钟左右：4–5 个房间、2–3 个 NPC、行动力 24 |
| 2 | 自由文本的开放范围 | 仅对话 / 对话加自由尝试 | 仅对话；P1 之后视数据决定是否开放 `attempt` |
| 3 | 谜题骨架来源 | 人工模板 + LLM 填充 / LLM 全生成 | 人工模板 + LLM 填充 |
| 4 | 入场消耗与次数 | 沿用 `dungeon_start` 气消耗 / 重新设计 | 沿用；单局时长变化后再评估单位时间收益 |
| 5 | 行动力是否可以用道具或资源补充 | 可以 / 不可以 | 首版不可以，避免付费换分 |
| 6 | 案卷是否允许不同玩家之间重复 | 允许 / 全局唯一 | 允许（每个角色不重复即可），降低生成成本 |
| 7 | 结局叙事是否必需 | 必需 / 仅展示评分明细 | 必需，但先展示评分，叙事异步流入 |

## 16. 示例：太岳山·无名古修士洞府

- **角色本**：你受散修韩老三之托，前来替他取回亡兄的遗物。同行的少女苏晚自称洞府主人的后人。
- **真相**（隐藏）：古修士死于弟子之手，那名弟子化名韩老三，想借你之手破开最后一道禁制；苏晚才是真正的后人。
- **房间**：瀑布洞口 → 石室（遗骸）→ 丹房（弟子名册）→ 静室（禁制）→ 暗道（需要钥匙）。
- **关键线索**：遗骸指骨上刻着半个“韩”字；名册被撕掉的一页（藏在丹炉灰中，需要先“使用”拨火钳）；苏晚的家族口传（向她出示指骨刻痕后解锁）；韩老三对“亡兄死于何年”的说法与名册矛盾（出示名册残页即可戳穿）。
- **误导线索**：洞口新鲜的妖兽爪痕（指向守洞妖兽，与命案无关）。
- **结案**：谁杀了古修士 → 韩老三；手段 → 丹房毒烟（线索：炉灰中的残毒）；禁制交给谁 → 苏晚。
- **分支**：指认正确时韩老三暴起，触发 BOSS 战；指认错误时禁制被他夺走，只能拿到基础分。

## 17. 实施进度

### P0（2026-11-02）

**已实现**

- 领域：`packages/game-domain/src/dungeon/mystery.ts`（模板、案卷、动作、运行态、玩家投影），子路径 `@daoyou/game-domain/dungeon/mystery`；`DungeonMapConfig.scenario`。
- 规则：`packages/game-rules/src/dungeon/mystery/`（动作引擎、条件求值、可达性与案卷校验、评分、玩家投影），子路径 `@daoyou/game-rules/dungeon/mystery`，13 个单元测试。
- 内容：`packages/game-content/src/dungeon/scenarios/`，模板 `inheritance_murder`（遗府疑案）及其手写保底案卷；`SAT_TN_01` 太岳山·无名古修士洞府配置了该剧本。
- API：`dungeon-case.md` 案卷生成（一次修正重试，校验失败回退保底案卷）；`POST /api/dungeon/mystery/act`、`POST /api/dungeon/mystery/deduce`；开局、退出、结算沿用原链路；关键线索按 `clue:<id>` 计入探索收益；结案时评分决定通关档位；所有下发状态在提交后投影为 `mysteryView`，案卷不出服务端。
- 前端：`DungeonMystery`（调查）、`DungeonMysteryNotebook`（案卷笔记）、`DungeonMysteryDeduction`（结案）、`DungeonMysteryResult`（评分明细与真相）。

**与设计的差异**

- P0 的“交谈”“出示”是确定性的：台词在案卷里预先写好，按条件解锁。LLM 自由对话留到 P1，届时替换台词来源，权限判断不变。
- 战斗槽位、案卷池、自由尝试（`attempt`）均未实现，模板评分中战斗权重为 0。
- 保底案卷与具体场景绑定（太岳山洞府），其他节点复用该模板前需要各自的保底案卷，或先完成案卷池。

**已验证（本地真实接口与页面，账号 local2）**

- 完整流程：开局 → 移动、搜查、使用物品（选择目标）、交谈、出示证据、带条件的锁门 → 结案 → 94 分 S 档，评级取规则评分，资源与 6 件探索物品实际发放，结局叙事依据推断结果写成。
- 调查动作响应约 30–60 ms；重放同一 `actionId` 不重复扣行动力；过期回合返回 409；不在场的目标、非法 id、未掌握的线索作答返回 400。
- `GET /api/dungeon/state` 与命令响应中不含案卷、真相或答案；中途离开结算为 C 档，不揭示真相。
- 未配置剧本的旧秘境会话仍按旧流程展示与结算。

**发现的问题**

- 当前 `LLM_PROVIDER`（qwen3.7-flash）一次生成整份案卷的可靠性不足：三次开局共五次生成均未通过校验（关键线索数不符、引用不存在的 id、问题缺少支撑线索），全部回退到保底案卷，单次开局耗时约 70 秒。已加入自动修复（秘密缺条件时视为到场可得、丢弃无效果的交互），首轮问题从 6 条降到 1 条，但仍未通过。P2 的案卷池应离线批量生成、多次重试，并考虑改用更强的模型；在此之前，玩家实际玩到的都是保底案卷。

**未验证**

- 移动端窄屏布局、`RECOVERABLE_ERROR` 状态下的解谜恢复、结算失败后的重试。
