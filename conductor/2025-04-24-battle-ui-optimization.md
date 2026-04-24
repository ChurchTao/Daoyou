# 战斗界面交互优化 (V5) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化战斗界面的弹窗组件复用、技能监控展示、数值格式化以及详细属性的 Modifier 展示。

**Architecture:** 
- 采用现有的 `@components/layout/InkModal` 替换原先手写的 Modal，确保 UI 一致性。
- 将技能监控改为轻量化的文字+颜色标签风格，并调整至战报日志下方。
- 在状态栏引入 `d3-format` 对动态数值进行定点格式化，防止宽体字符引起的容器变动。
- 扩展引擎状态快照以捕获基础属性（`baseAttributes`），并在属性面板中渲染 "基础值 + 绿字加成" 的视觉效果。

**Tech Stack:** TypeScript, Next.js, Tailwind CSS, d3-format.

---

### Task 1: 扩展基础属性 (Base Attributes) 数据链路

**Files:**
- Modify: `engine/battle-v5/units/AttributeSet.ts`
- Modify: `engine/battle-v5/core/types.ts`
- Modify: `engine/battle-v5/units/Unit.ts`
- Modify: `engine/battle-v5/systems/state/types.ts`
- Modify: `engine/battle-v5/systems/state/BattleStateRecorder.ts`

- [ ] **Step 1: 在 AttributeSet 增加获取全部基础值的方法**

```typescript
// engine/battle-v5/units/AttributeSet.ts

  getAllBaseValues(): Record<AttributeType, number> {
    const result = {} as Record<AttributeType, number>;
    this._attributes.forEach((attr, type) => {
      result[type] = attr.getBaseValue();
    });
    return result;
  }
```

- [ ] **Step 2: 扩展 UnitSnapshot 和 Unit 采集逻辑**

```typescript
// engine/battle-v5/core/types.ts
export interface UnitSnapshot {
  // ...
  baseAttributes: Record<AttributeType, number>;
}

// engine/battle-v5/units/Unit.ts
  getSnapshot(): UnitSnapshot {
    return {
      // ... 原有逻辑
      baseAttributes: this.attributes.getAllBaseValues(),
    };
  }
```

- [ ] **Step 3: 扩展 UnitStateSnapshot 和 Recorder**

```typescript
// engine/battle-v5/systems/state/types.ts
export interface UnitStateSnapshot {
  // ...
  attrs: AttrsStateView;
  baseAttrs: AttrsStateView;
}

export interface UnitStateDelta {
  // ...
  baseAttrs?: Partial<Record<keyof AttrsStateView, { from: number; to: number }>>;
}
```

```typescript
// engine/battle-v5/systems/state/BattleStateRecorder.ts
// 修改 _buildAttrs 支持获取基础值
  private _buildAttrs(unit: Unit, useBase = false): AttrsStateView {
    const a = unit.attributes;
    const getVal = useBase ? (t: AttributeType) => a.getBaseValue(t) : (t: AttributeType) => a.getValue(t);
    return {
      spirit: getVal(AttributeType.SPIRIT),
      // ... 原样映射其他属性
    };
  }

// _buildSnapshot 中加入
  baseAttrs: this._buildAttrs(unit, true),

// _computeDelta 中加入对 baseAttrs 的对比 (类似 attrs)
```

- [ ] **Step 4: 验证编译**
`npx tsc --noEmit --skipLibCheck`
*Note: Any type errors related to `baseAttrs` not being present in mock data might occur; if they do, update the mock objects in tests.*

---

### Task 2: 属性数值格式化 (d3-format)

**Files:**
- Modify: `components/feature/battle/v5/CombatStatusHeader.tsx`

- [ ] **Step 1: 引入并应用 d3-format**

```tsx
import { format } from 'd3-format';

// 格式化器
const fmtInt = format(',d');
const fmtPct = format('.1f'); // 保留 1 位小数

function UnitCard({ unit, isOpponent, onShowDetails }: UnitCardProps) {
  // 计算紧凑属性
  const mainAtk = Math.max(unit.attrs.atk || 0, unit.attrs.magicAtk || 0);
  const critRate = (unit.attrs.critRate || 0) * 100;
  const evasionRate = (unit.attrs.evasionRate || 0) * 100;

  // 使用
  <span>攻 {fmtInt(mainAtk)}</span>
  <span>暴 {fmtPct(critRate)}%</span>
  <span>闪 {fmtPct(evasionRate)}%</span>
  // ...
```

---

### Task 3: 重构详细属性弹窗 (InkModal + Modifier 展示)

**Files:**
- Modify: `components/feature/battle/v5/CombatAttributeModal.tsx`

- [ ] **Step 1: 引入 InkModal 并重构组件**

```tsx
import { InkModal } from '@/components/layout/InkModal';
// import { format } from 'd3-format'; // 也可以考虑引入用于排版

export function CombatAttributeModal({ unit, isOpen, onClose }: Props) {
  // ... 
  const renderAttr = (key: keyof AttrsStateView, isPercentage = false) => {
    const finalVal = unit.attrs[key];
    const baseVal = unit.baseAttrs[key];
    const modifier = finalVal - baseVal;
    
    // ... 格式化数值，如果 modifier > 0 (考虑到浮点误差用 > 0.001)，渲染绿字
    // 如：15 + 5
  }

  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title={`角色详细属性 - ${unit.name}`}
    >
      // 内部只放内容 grid，不需要自定义背景和头部
    </InkModal>
  )
}
```

---

### Task 4: 简化并下移技能监控栏 (CombatSkillBar)

**Files:**
- Modify: `components/feature/battle/v5/CombatSkillBar.tsx`
- Modify: `app/(game)/game/battle/components/BattleView.tsx` (及其他战斗页面)

- [ ] **Step 1: 极简版 CombatSkillBar**

```tsx
// 移除复杂的带遮罩图标，改为文字加彩色边框或文字颜色
return (
  <div className="flex flex-col gap-1 p-2 border border-ink/10 bg-white/20 rounded-sm mt-4">
    <div className="text-[10px] text-ink/40">技能监控</div>
    <div className="flex flex-wrap gap-2 text-xs">
      {unit.cooldowns.map(skill => {
        const isOnCd = skill.current > 0;
        return (
          <span key={skill.skillId} className={cn(
            "px-1.5 py-0.5 border rounded-sm",
            isOnCd ? "text-ink/40 border-ink/20" : "text-teal border-teal/30 bg-teal/5"
          )}>
            {skill.skillName} {isOnCd ? `(CD:${skill.current})` : ''}
          </span>
        )
      })}
    </div>
  </div>
)
```

- [ ] **Step 2: 调整战斗页面的布局顺序**
将 `<CombatSkillBar />` 移至 `<CombatActionLog />` 下方、`<CombatControlBar />` 上方（或者紧贴控制栏）。分别更新 `BattleView.tsx`, `TrainingRoomPage.tsx`, `DungeonBattle.tsx`, `ChallengeBattlePage.tsx`, `BetBattleChallengePage.tsx`。

---

### Task 5: 验证并提交

- [ ] **Step 1: 执行所有测试并修复 TS 报错**
`npm test engine/battle-v5`
`npx tsc --noEmit --skipLibCheck`

- [ ] **Step 2: 提交**
`git commit -m "feat(ui): optimize battle modal, skill bar, stats formatting, and expose base attributes"`
