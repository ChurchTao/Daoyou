## 修真系统改造方案概览

分三部分：**境界属性上限机制重构**、**闭关与突破玩法设计**、**寿元耗尽与转世流程**。在实现上，主要围绕现有的 `cultivatorUtils`、`characterEngine`、前端页面与 AIGC Prompt 做增量扩展，尽量兼容已有角色与战斗系统。

---

## 一、境界 + 阶段属性上限重构

- **1.1 数据结构与常量层设计**
- 在 `types/constants.ts` 中增加一个新的映射常量，例如 `REALM_STAGE_CAPS`，键为 `(realm, realm_stage)` 组合，值为该小阶段的属性上限：
- 炼气：20 / 40 / 60
- 筑基：80 / 100 / 120
- 金丹：140 / 160 / 180
- 元婴：220 / 240 / 260
- 化神：300 / 320 / 340
- 炼虚：400 / 420 / 440
- 合体：500 / 520 / 560
- 大乘：600 / 620 / 640
- 渡劫：700 / 720 / 740
- 在 `cultivatorUtils.ts` 新增 `getRealmStageAttributeCap(realm, realmStage)`，使用上述映射返回具体上限。

- **1.2 角色生成与平衡引擎接入新上限**
- 在 `characterEngine.ts` 中：
- 替换现有使用 `getRealmAttributeCap(realm)` 的逻辑，改为使用 `getRealmStageAttributeCap(realm, realmStage)` 来计算属性上限和总和上限（例如 `totalCap = cap * 5`）。
- 调整 `validateAttributeBalance`、`adjustAttributesToBalance`、`applyHeavenlyBalance` 等内部逻辑，使其引用新的分阶段上限，但仍只作用于角色创建/平衡阶段，不影响战斗过程中的临时属性。
- 在 `cultivatorUtils.ts` 中：
- 保留原 `getRealmAttributeCap`（如有兼容需求，可改为内部使用最低小阶段上限或标记为废弃），但在新逻辑中统一使用 `getRealmStageAttributeCap`。

- **1.3 取消战斗过程中的暴力裁剪**
- 在 `calculateFinalAttributes(cultivator)` 中：
- 移除当前基于 `getRealmAttributeCap(c.realm)` 的 `Math.min` 裁剪逻辑，仅在角色基础属性（`c.attributes`）录入/生成/突破时确保不超过小境界上限。
- 保留 `breakdown` 结构，`cap` 字段可改为该角色当前小阶段的属性上限（用于展示说明），但不再在这里进行裁剪。

---

## 二、闭关与突破系统设计

- **2.1 数据扩展：悟性、修为与突破记录**
- 在 `types/cultivator.ts` 中：
- 确认是否已有“悟性（如 wisdom）”作为属性；若需要单独“悟性”字段，可新增例如 `comprehension` 或通过注释明确 `wisdom` 同时承担悟性作用。
- 增加可选字段：
- `closed_door_years_total?: number`：累积闭关年限（用于故事描述与成就感）。
- `breakthrough_history?: { from_realm: RealmType; from_stage: RealmStage; to_realm: RealmType; to_stage: RealmStage; age: number; story?: string }[]`：突破历史记录（可选，便于前端展示角色成长线）。
- 增加闭关记录与突破记录，记录闭关时的境界，闭关年限，是否突破等数据，用于补偿下次闭关，突破记录用于前端显示修炼史

- **2.2 闭关与突破核心算法（后端/工具层）**
- 在 `utils` 下新增 `breakthroughEngine.ts`（或在 `characterEngine.ts` 中新增模块化函数）：
- `getNextStage(realm, realm_stage)`：返回下一小境界（同境界初/中/后/圆满 → 若从圆满再突破则进阶到下一大境界初期）。
- `getBreakthroughBaseChance(realm, realm_stage, targetType)`：根据当前境界与目标（小境界 or 大境界）给出基础成功率：
- 小境界突破：基础概率相对较高，如 60% 起步，随境界提升指数递减。
- 大境界突破：基础概率较低，如 30% 起步，随境界提升进一步递减。
- 概率衰减可设计为：`base * exp(-k * realmIndex)` 或简单表驱动（在常量表中定义每个大境界的小/大突破基础概率）。
- 读取角色在本境界的闭关记录，如果角色没能在上次闭关中突破，那么会增加本次闭关时的成功率
- `getBreakthroughModifierByComprehension(wisdomOrComprehension)`：悟性越高加成越大，可转化为线性或分段加成（例如按档：凡人 ≤60，无加成；60~80 +5%~10%；80~100 +10%~20%，并设置上限）。
- `getBreakthroughModifierByYears(years)`：闭关年限越久越容易突破，设定线性/对数收益递减，避免一年与百年差距过于极端。
- 综合成功率计算：
- \( p = clamp(p*{base} + p*{comprehension} + p*{years}, p*{min}, p\_{max}) \)
- 并随境界提升调低 `p_max`（例如渡劫前大境界突破几率不超过 30%）。
- 闭关消耗寿元：
- 用户选择闭关年数 `N`：
  - `age += N`
  - `lifespan` 不变（代表总寿元），死亡判定使用 `age > lifespan`。
  - 若你希望“寿元值可被突破增加”而不是年龄倒计时，则“寿元 = lifespan - age”可用于前端展示。
- 突破成功后的属性与寿元变更：
- 根据悟性，从一个范围中随机或按函数增长基础属性（仅改 `c.attributes`，不动装备/功法加成）：
  - 可按悟性档位定义“单次突破基础属性增长区间”，如悟性高时每次突破为每项 +X~Y，或按总点数分配。
  - 严格在应用成长前，对新属性用 `getRealmStageAttributeCap(toRealm, toStage)` 进行裁剪，保证不超上限。
  - 悟性不会增长（重要）
- 寿元增加规则：
  - 练气期初始生成时寿元范围为 100–130（在角色生成 Prompt 与校验中配合调整）。
  - 突破到各大境界时（从某境界圆满 → 下一境界初期）在 `lifespan` 上累加：
  - 筑基 +200
  - 金丹 +500
  - 元婴 +1200
  - 化神 +2000
  - 炼虚 +3000
  - 合体 +4000
  - 大乘 +5000
  - 渡劫 +8000
  - 小境界突破只增加属性，不额外增加寿元（或可增加少量常数，如 +10~20 年，可作为可选拓展）。
- 返回结构：
- `{ success, newCultivator, fromRealm, fromStage, toRealm?, toStage?, isMinorBreakthrough, chance, roll, yearsSpent }`。

- **2.3 闭关/突破 AIGC 故事生成接口**
- 在 `utils/prompts.ts` 中新增：
- `getBreakthroughStoryPrompt({ cultivator, fromRealm, fromStage, toRealm, toStage, yearsSpent, chance, roll }): [systemPrompt, userPrompt]`：
- systemPrompt：设定为修仙文作者风格，要求根据角色信息、闭关年限、突破前后境界生成一小段 100–300 字故事，可包含悟道细节、瓶颈描写等。
- userPrompt：提供角色摘要（姓名、年龄、寿元、悟性、境界、灵根、功法），闭关时间，突破背景与结果，用于 AIGC 生成。
- 在调用 AIGC 的封装（例如 `aiClient` 或相关 API route）中新增一个 endpoint：
- 接收上述 prompt，返回一段 HTML/Markdown 文本，前端在闭关结果弹窗或详情页展示。

- **2.4 前端交互与接口设计（闭关功能）**
- 在角色详情或某主页面（例如 `app/page.tsx` 或独立 `app/retreat/page.tsx`）增加“闭关”入口：
- 用户可在 UI 上输入/选择闭关年数（范围可限制，例如 1–500 年）。
- 点击“开始闭关”后调用 API：`POST /api/cultivator/retreat`。
- 新增 API route：`app/api/cultivator/retreat/route.ts`：
- 读取当前角色（可来自 session / DB / 本地存储，按你现有架构接入）。
- 执行闭关逻辑：更新年龄 → 判定寿元是否已尽；若未尽，则按算法计算突破结果；成功则更新境界与属性，并触发 AIGC 故事生成；失败则仅消耗年限并可返回提示信息（例如“本次闭关未能突破，心有所悟”）。
- 返回：`{ cultivator: newCultivator, breakthroughResult, story?: string }`。
- 前端在闭关结束后：
- 刷新角色信息（显示新境界、属性、年龄、寿元）。
- 弹出突破/失败故事弹窗，使用 AIGC 返回的文本。

---

## 三、寿元耗尽与转世重修流程

- **3.1 寿元耗尽判定与故事生成**
- 在闭关逻辑（以及其他可能消耗时间的玩法中，将来可复用）统一使用：
- 死亡条件：`age >= lifespan`。
- 当闭关结束时若判定角色寿元耗尽且本次突破失败：
- 构造并调用新的 AIGC Prompt 函数，例如在 `prompts.ts` 中新增：
- `getLifespanExhaustedStoryPrompt({ cultivator, realm, realmStage, age, lifespan, failedBreakthroughInfo }): [systemPrompt, userPrompt]`。
- 要求模型写出一段围绕“坐化”“油尽灯枯”“执念未了”“天道轮回”的短篇故事，字数 200–400 字，可包含对过往修行的回顾，为“转世重修”埋伏笔。

- **3.2 前端：转世重修引导页面**
- 新增页面 `app/reincarnate/page.tsx`（命名可根据你的路由风格调整）：
- 展示寿元耗尽故事文本以及角色生平简要信息。
- 提供一个明显的“转世重修”按钮，点击后跳转到现有的角色创建流程（如 `app/create/page.tsx`），并可通过 query 参数注明“这是转世角色”，以便在 Prompt 或 UI 上做些趣味化文案（如“携前世残忆”）。
- 在闭关接口返回寿元耗尽状态时：
- 前端弹窗中展示 AIGC 故事，并提供“前往转世重修”按钮，路由跳转到新页面。

- **3.3 后端/状态管理：角色轮回处理**
- 若当前有持久化存储（localStorage/数据库），在转世后：
- 可选择保留前世角色信息为“前世档案”，用于将来的彩蛋或数值继承（例如初始有小幅悟性加成），本方案暂不强制实现，仅预留结构。
- 若你希望加入轻微继承机制，可在角色创建 Prompt 或 `characterEngine` 中检测“是否为转世角色”，适度提升初始悟性或灵根强度，并在 `balance_notes` 中表述“前世余荫”。

---

## 四、数值与平衡建议

- **4.1 概率与成长建议**
- 先通过配置表控制而非写死在代码中，例如在一个 `configs/breakthroughConfig.ts` 中定义：
- 每一大境界的小突破/大突破基础概率；
- 各悟性档位对应的成功率加成；
- 闭关年限对应的成功率加成曲线；
- 每次突破的基础属性成长区间（按悟性档位或按境界划分）。
- 将以上配置与函数解耦，便于后续通过调参快速迭代数值平衡。

- **4.2 与现有平衡系统的衔接**
- 保持 `characterEngine.validateAndAdjustCultivator` 作为“生成期/创建期平衡守门员”，突破产生的新 `attributes` 与 `realm/realm_stage` 应按同样规则被验证，确保不会生成超模角色。
- 战斗中只读取当前存储的 `cultivator` 数据，不在战斗公式中再对属性做境界裁剪，只保留技能、命格等已有的加成与削弱机制。

---

## 五、实施顺序建议

- **步骤 1**：实现 `REALM_STAGE_CAPS` 和 `getRealmStageAttributeCap`，重构 `characterEngine` 的属性上限与校验逻辑，并移除战斗中的暴力属性裁剪。
- **步骤 2**：设计并实现 `breakthroughEngine`（闭关+突破算法），打通与寿元（age/lifespan）字段的联动与境界、属性成长。
- **步骤 3**：在 `prompts.ts` 中补充突破与寿元耗尽的故事 Prompt，并在后端封装 AIGC 调用接口。
- **步骤 4**：实现前端闭关操作入口、结果展示弹窗与“寿元耗尽 → 转世重修”流程，包括新建 `reincarnate` 页面和必要的路由跳转。
- **步骤 5**：结合实际游玩体验调参突破成功率与成长数值，微调悟性/闭关年限对成功率的影响，确保节奏合理、既有挫折感又不过度劝退。
