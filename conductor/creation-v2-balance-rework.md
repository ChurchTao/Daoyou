# 造物引擎 v2 核心数值重构计划 (Creation Engine v2 Balance Rework)

## Objective (目标)
重构造物引擎 v2 的核心数值模型，解决当前的三个断裂点（能效转换率偏低、词条成本与槽位锁定的矛盾、低阶品质过度拥挤），建立健康的“能效金字塔”。通过指数化材料权重、动态调整槽位与解锁阈值、将数值效率纳入战力评估（PBU），并重新校准品质阈值，使造物系统的产出品质更符合玩家的投入期望。

## Key Files & Context (关键文件与上下文)
*   **配置文件**: `engine/creation-v2/config/CreationBalance.ts` (材料权重、槽位梯次、解锁阈值)
*   **平衡计算**: `engine/creation-v2/balancing/PBU.ts` (PBU 及分项渠道计算)
*   **持久化与评分**: `engine/creation-v2/persistence/ScoreCalculator.ts` (PBU 到品质的映射)
*   **测试用例**: `engine/creation-v2/tests/**/*.test.ts` (特别是 `CreationBalanceMonteCarlo.test.ts`, `MaterialAnalysis.test.ts`, `PBU.test.ts`, `DefaultEnergyBudgeter.test.ts` 等依赖硬编码能量值的测试)

## Implementation Steps (实施步骤)

### 1. 调整材料基础权重 (Exponential Material Weights)
*   **文件**: `engine/creation-v2/config/CreationBalance.ts`
*   **修改点**: 将 `CREATION_MATERIAL_ENERGY.qualityWeights` 从线性增长 `[3, 4, 6, 7, 8, 10, 12, 14]` 修改为指数（类斐波那契）增长 `[3, 5, 8, 13, 21, 34, 55, 89]`，大幅拉开高低阶底材的能量密度。

### 2. 重新校准解锁阈值与槽位开放梯次 (Unlock Thresholds & Slot Tiers)
*   **文件**: `engine/creation-v2/config/CreationBalance.ts`
*   **修改点 A**: `CREATION_AFFIX_UNLOCK_THRESHOLDS` 中层池（variant/school/defense）解锁阈值从 `20` 提升至 `25`；稀有池（rare/secret/treasure）从 `49` 大幅提升至 `80`。
*   **修改点 B**: `CREATION_ENERGY_SLOT_TIERS` 的最大能量阈值（maxEnergy）调整为：2槽 `<25`，3槽 `<50`，4槽 `<90`，5槽 `Infinity`（实际需 90+ 能量）。

### 3. 将“数值灵魂”融入 PBU 评估 (Roll Efficiency in PBU)
*   **文件**: `engine/creation-v2/balancing/PBU.ts`
*   **修改点**: 在 `estimateBalanceMetrics` 中计算 `rawChannels` 时，原逻辑为 `affix.energyCost * CATEGORY_MULTIPLIER`，现引入 `rollEfficiency` 加成：乘以 `(0.8 + 0.4 * affix.rollEfficiency)`。
*   **附加奖励**: 遍历 `affixes` 时，若触发 `isPerfect`（极品标记），为最终的 PBU 附加固定值奖励（例如每个 Perfect 词条 +15 PBU）。

### 4. 调整 PBU 到品质的映射阈值 (PBU Quality Thresholds)
*   **文件**: `engine/creation-v2/persistence/ScoreCalculator.ts`
*   **修改点**: 修改 `PBU_QUALITY_THRESHOLDS` 数组，将阈值调整为拉开中低端差距并抬高神品门槛：
    *   神品: `230` (原 220)
    *   仙品: `170` (原 160)
    *   天品: `120` (原 110)
    *   地品: `80` (原 75)
    *   真品: `50` (维持不变)
    *   玄品: `25` (原 30)
    *   灵品: `12` (原 15)
    *   凡品: `0`

### 5. 全面修复并对齐单元测试 (Fix and Align Unit Tests)
*   **范围**: 由于底层能量计算逻辑发生了根本性变化，几乎所有涉及具体能量值断言的测试都会失败。
*   **任务**: 
    *   更新 `CreationBalanceMonteCarlo.test.ts` 中的断言区间（P50 期望值、解锁率等）。
    *   更新 `MaterialAnalysis.test.ts` 和 `DefaultEnergyBudgeter.test.ts` 中手算的预期 `baseTotal` 和 `effectiveTotal`。
    *   更新 `PBU.test.ts` 中针对特定词条推算的 PBU 值和 TTK Band。
    *   修复 E2E 测试中因能量不足导致无法抽出高阶词条的 Mock 数据（例如提升 Mock 材料的品质或数量，以满足新的 `80` 能量解锁门槛）。

## Verification & Testing (验证与测试)
1.  执行 `npm test`，确保造物引擎 V2 目录下的所有测试（尤其是 MonteCarlo 和 PBU 相关测试）100% 通过。
2.  通过测试日志或 E2E 预览脚本，观察极品材料（如多个神品/仙品）的实际输出 PBU 是否能稳定突破 220，且低级材料的 PBU 严格限制在较低区间。