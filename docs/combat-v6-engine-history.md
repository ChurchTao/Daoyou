# combat-v6 引擎阶段历史

2026-10-04 包拆分说明：下文目录布局是历史阶段记录。当前确定性内核位于 `packages/combat-core/src`，模型位于 `packages/game-domain/src`，内容位于 `packages/game-content/src`，投影、玩法战斗与讨伐位于 `packages/game-rules/src`，已提取协议位于 `packages/contracts/src`。当前迁移范围及未完成验收见 [应用边界](architecture-boundaries.md)。不要按下文旧路径重新建立实现。

数值基线后续治理以
[`手游数值基线治理计划`](combat-v6-mobile-numerical-governance-plan.md)
为准：主要参照《梦幻西游》手游，按证据与版本、伤害结算、人物及召唤灵五维、装备范围、技能微调的顺序推进。当前实现仍是旧数值；该计划不代表已完成手游公式对齐。

新体系设计与隔离边界见
[`docs/combat-v6-mhxy-redesign-roadmap.md`](combat-v6-mhxy-redesign-roadmap.md)
为 canonical 文档。角色六维、面板和投影约束见
[`docs/combat-v6-character-panel-design.md`](combat-v6-character-panel-design.md)，新版道装领域见
[`docs/combat-v6-equipment-system-design.md`](combat-v6-equipment-system-design.md)，
新版功法领域见
[`docs/combat-v6-manual-system-design.md`](combat-v6-manual-system-design.md)，Phase 5A 数值见
[`docs/combat-v6-manual-phase-5a-balance.md`](combat-v6-manual-phase-5a-balance.md)，红尘剑宗完整纵切见
[`docs/combat-v6-lingxiao-datang-sect-design.md`](combat-v6-lingxiao-datang-sect-design.md)。
幽都经典双流派纵切见
[`docs/combat-v6-youdu-classic-sect-design.md`](combat-v6-youdu-classic-sect-design.md)。
无相禅宗治疗防护纵切见
[`docs/combat-v6-wuxiang-sect-design.md`](combat-v6-wuxiang-sect-design.md)。
天衍圣地河洛九宫纵切见
[`docs/combat-v6-tianyan-sect-design.md`](combat-v6-tianyan-sect-design.md)。
九劫天宫经典双流派纵切见
[`docs/combat-v6-jiujie-tiangong-redesign.md`](combat-v6-jiujie-tiangong-redesign.md)。
当前角色投影、模式 Host、Redis 与回放边界见
[`V6 当前实现与退役边界`](combat-v6-runtime.md)。历史阶段适配器和维护脚本已移除。

`core/` 当前是
`/Users/churcht/Documents/GitHub/mhxy-combat-copy/packages/engine/src`
的完整源码副本，作为梦幻式 we-go 回合战斗的隔离内核。

当前入口：

- `core/`：规则无关的确定性 we-go 内核，不反向依赖规则、投影或宗门内容。
- `rules-daoyou/`：当前 `daoyouRulesetV6` 和可配置公式；阶段 V2—V5 包装已删除。
- `projection/`：`projectCharacterToCombatV6` 编译个人道装、功法、炼体及可选宗门进度；基础投影是内部复用组件。
- `content/`：五宗门当前目录、编译与校验；阶段目录及编译适配器已删除。
- `equipment/`、`manuals/`、`beasts/`：当前领域事实、内容编译与培养规则。已存装备版本的解析仍保留。
- 各模式 Host：复用当前投影及内核；服务器负责 Redis 权威状态、占用、资源结算与回放归档。
- `version.ts`：当前版本戳；本轮清理只收敛代码命名，不改写存储版本字符串。

历史阶段源码及验收过程可从 Git 历史查看。当前运行约束、旧资产保留范围和延期删表见 [V6 当前实现与退役边界](combat-v6-runtime.md)。有效共享领域测试继续保留。
