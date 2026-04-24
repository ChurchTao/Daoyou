# 战斗界面交互补全 (V5) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全战斗页面的实时属性显示、详细属性弹窗以及玩家技能监控功能。

**Architecture:** 
- 扩展引擎层的快照数据，在每一帧中记录技能冷却和完整属性。
- 使用 React 状态驱动 UI 渲染，通过 `useCombatPlayer` 挂钩分发最新的 `unitSnapshots`。
- 采用 Modal 模式处理详细数据，保持主界面简洁。

**Tech Stack:** TypeScript, Next.js, Tailwind CSS, Lucide React (icons).

---

### Task 1: 引擎层数据结构扩展

**Files:**
- Modify: `engine/battle-v5/core/types.ts`
- Modify: `engine/battle-v5/units/Unit.ts`

- [ ] **Step 1: 扩展 UnitSnapshot 接口**

```typescript
// engine/battle-v5/core/types.ts

export interface AbilitySnapshot {
  id: string;
  name: string;
  currentCd: number;
  maxCd: number;
  mpCost: number;
  type: AbilityType;
}

export interface UnitSnapshot {
  // ... 现有字段
  abilities: AbilitySnapshot[]; // 新增
}
```

- [ ] **Step 2: 在 Unit.ts 中捕获技能状态**

```typescript
// engine/battle-v5/units/Unit.ts -> getSnapshot 方法

getSnapshot(): UnitSnapshot {
  return {
    // ... 原有逻辑
    abilities: this.abilities.getSnapshots(), // 假设 AbilityContainer 已有此方法或需新增
    attributes: this.attributes.getAllFinalValues(), // 确保包含所有属性
  };
}
```

- [ ] **Step 3: 提交**
`git commit -m "chore(engine): extend UnitSnapshot to include ability states"`

---

### Task 2: 紧凑型属性条开发 (Compact Stats Bar)

**Files:**
- Modify: `components/feature/battle/v5/CombatStatusHeader.tsx`

- [ ] **Step 1: 计算并渲染关键属性**

```tsx
// 逻辑：主攻(取物法最大值) | 暴击 | 闪避
const mainAtk = Math.max(unit.attributes.atk || 0, unit.attributes.magicAtk || 0);
const critRate = Math.round((unit.attributes.critRate || 0) * 100);
const evasionRate = Math.round((unit.attributes.evasionRate || 0) * 100);

// JSX 增加点击区域
<div 
  className="flex gap-2 text-[9px] mt-1 opacity-60 cursor-pointer hover:opacity-100 transition-opacity"
  onClick={onShowDetails}
>
  <span>攻 {mainAtk}</span>
  <span className="opacity-30">|</span>
  <span>暴 {critRate}%</span>
  <span className="opacity-30">|</span>
  <span>闪 {evasionRate}%</span>
</div>
```

- [ ] **Step 2: 提交**
`git commit -m "feat(ui): add compact stats display to CombatStatusHeader"`

---

### Task 3: 详细属性弹窗 (Detailed Modal)

**Files:**
- Create: `components/feature/battle/v5/CombatAttributeModal.tsx`

- [ ] **Step 1: 实现水墨风弹窗**

```tsx
export function CombatAttributeModal({ unit, isOpen, onClose }: Props) {
  // 渲染 5维基础属性 + 二级派生属性列表
  // 使用 Dialog 或简单的固定定位 Div
}
```

- [ ] **Step 2: 提交**
`git commit -m "feat(ui): implement CombatAttributeModal for detailed stats"`

---

### Task 4: 玩家技能监控栏 (Player Skill Bar)

**Files:**
- Create: `components/feature/battle/v5/CombatSkillBar.tsx`

- [ ] **Step 1: 实现技能状态逻辑**

```tsx
// 过滤 ACTIVE_SKILL，展示图标、CD遮罩、MP不足提示
const isLowMp = unit.currentMp < ability.mpCost;
const isOnCd = ability.currentCd > 0;

return (
  <div className={cn(
    "relative w-10 h-10 rounded-sm overflow-hidden",
    isOnCd && "grayscale",
    isLowMp && "border border-blue-400"
  )}>
    {isOnCd && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">{ability.currentCd}</div>}
  </div>
)
```

- [ ] **Step 2: 提交**
`git commit -m "feat(ui): add CombatSkillBar for player active skills"`

---

### Task 5: 页面集成与验证

**Files:**
- Modify: `app/(game)/game/battle/components/BattleView.tsx` (以及其他战斗页面)

- [ ] **Step 1: 挂载新组件并连接状态**

- [ ] **Step 2: 验证手动操作与进度同步**

- [ ] **Step 3: 最终提交**
`git commit -m "feat: integrate detailed stats and skill monitoring across all battle pages"`
