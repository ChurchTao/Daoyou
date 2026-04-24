# 战斗界面交互补全设计文档 (V5)

## 1. 概述
补全战斗界面缺失的关键信息展示：实时属性面板、技能状态与冷却监控。通过扩展 V5 战斗记录的快照数据，实现与回放进度同步的动态 UI 展现。

## 2. 属性展示方案

### 2.1 紧凑型属性条 (Compact Stats Bar)
- **展示位置**: `CombatStatusHeader` 组件内，气血/灵力条下方。
- **展示逻辑**:
    - **主攻击**: `Math.max(unit.atk, unit.magicAtk)`。
    - **暴击率**: `unit.critRate * 100`%。
    - **闪避率**: `unit.evasionRate * 100`%。
- **文案格式**: `攻 {val} | 暴 {val}% | 闪 {val}%`
- **交互**: 点击该区域触发 `CombatAttributeModal`。

### 2.2 详细属性弹窗 (Detailed Attribute Modal)
- **展示内容**: 
    - 基础属性：体、灵、速、神、悟。
    - 派生属性：双攻、双防、暴击、闪避、破防、穿透等。
    - 状态：当前所有的 Buff 列表及其剩余回合。
- **样式**: 水墨风半透明 Modal，两栏列表布局。

## 3. 技能监控方案

### 3.1 玩家技能栏 (Combat Skill Bar)
- **展示位置**: 仅在玩家（自身）一侧显示。
- **显示逻辑**: 
    - 遍历玩家携带的 `ACTIVE_SKILL`。
    - 实时读取快照中的 `currentCd`。
- **视觉反馈**:
    - **可用**: 正常彩色图标。
    - **冷却中**: 图标置灰 + 黑色半透明遮罩 + 白色倒计时数字。
    - **灵力不足**: 图标边缘显示蓝色/紫色流光。

## 4. 技术实现

### 4.1 数据结构扩展
在 `engine/battle-v5/core/types.ts` 中扩展 `UnitSnapshot`：
```typescript
export interface AbilitySnapshot {
  id: string;
  name: string;
  currentCd: number;
  maxCd: number;
  mpCost: number;
}

export interface UnitSnapshot {
  // ... 原有字段
  abilities: AbilitySnapshot[];
}
```

### 4.2 引擎适配
- 修改 `engine/battle-v5/units/Unit.ts` 中的 `getSnapshot()` 方法，调用 `AbilityContainer.getSnapshots()` 来获取技能状态。

### 4.3 UI 适配
- `useCombatPlayer.ts`: 确保 `unitSnapshots` 包含新增的 `abilities` 数据。
- `CombatStatusHeader.tsx`: 渲染紧凑属性。
- `CombatSkillBar.tsx`: (新组件) 渲染技能栏。
- `CombatAttributeModal.tsx`: (新组件) 渲染详细属性。

## 5. 验收标准
1. 点击血条区域能看到详细属性面板。
2. 玩家释放技能后，下方的技能图标立即进入 CD 状态并随回合递减。
3. 属性条数值随战斗过程（Buff 加成等）实时波动。
