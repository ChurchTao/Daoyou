# 状态引擎集成指南

## 已完成工作

### 第一阶段:基础框架(已完成✅)

1. **类型定义** (`engine/status/types.ts`)
   - 完整的状态数据结构(StatusInstance, StatusDuration, StatusSource等)
   - 枚举类型(StatusType, SourceType, DurationType, ConditionType)
   - 状态应用和刷新相关的请求/响应类型

2. **状态注册表** (`engine/status/StatusRegistry.ts`)
   - 集中管理所有状态定义
   - 预注册了战斗状态(buff/debuff/control/dot)
   - 预注册了持久状态(weakness)
   - 提供状态定义查询接口

3. **效果计算器** (`engine/status/calculators/`)
   - `AttributeModifierCalculator`: 计算状态对属性的修正
   - `DamageOverTimeCalculator`: 计算DOT伤害
   - `ActionBlockerCalculator`: 判断行动限制
   - `ResistanceCalculator`: 计算抵抗率

4. **状态容器** (`engine/status/StatusContainer.ts`)
   - 完整的状态生命周期管理(添加/移除/刷新)
   - 支持状态叠加和互斥规则
   - 抵抗判定集成
   - 属性修正计算
   - 序列化/反序列化支持

5. **常量扩展** (`types/constants.ts`)
   - 扩展STATUS_EFFECT_VALUES,添加持久状态和环境状态

### 第二阶段:战斗引擎集成(进行中)

## 集成步骤详解

### 步骤1: 修改BattleUnit数据结构

需要在`battleEngine.ts`中修改BattleUnit接口:

```typescript
interface BattleUnit {
  id: UnitId;
  data: Cultivator;
  hp: number;
  mp: number;
  // 旧的: statuses: Map<StatusEffect, StatusInstance>;
  // 新的:
  statusContainer: StatusContainer;
  skillCooldowns: Map<string, number>;
  isDefending: boolean;
}
```

### 步骤2: 修改initUnit函数

在初始化BattleUnit时,创建StatusContainer:

```typescript
const initUnit = (
  data: Cultivator,
  id: 'player' | 'opponent',
  initialState?: InitialUnitState,
): BattleUnit => {
  // ... 现有代码 ...
  
  return {
    id,
    data,
    hp: initialState?.hp ?? finalAttrs.maxHp,
    mp: initialState?.mp ?? finalAttrs.maxMp,
    statusContainer: new StatusContainer(), // 新增
    skillCooldowns: cds,
    isDefending: false,
  };
};
```

如果需要从外部传入初始状态(副本场景):

```typescript
export interface InitialUnitState {
  hp?: number;
  mp?: number;
  persistentStatuses?: StatusInstance[]; // 新增
}

// 在initUnit中加载
if (initialState?.persistentStatuses) {
  unit.statusContainer.fromJSON(initialState.persistentStatuses);
}
```

### 步骤3: 替换tickStatusEffects函数

将现有的`tickStatusEffects`函数改为调用StatusContainer:

```typescript
// 旧的实现:删除或注释掉
// function tickStatusEffects(unit: BattleUnit, log: string[]): void { ... }

// 新的实现:
function tickStatusEffects(unit: BattleUnit, state: BattleState): void {
  const context: TickContext = {
    currentTurn: state.turn,
    currentTime: Date.now(),
    unitSnapshot: {
      unitId: unit.id,
      currentHp: unit.hp,
      currentMp: unit.mp,
      maxHp: calcFinalAttrs(unit.data).maxHp,
      maxMp: calcFinalAttrs(unit.data).maxMp,
      baseAttributes: calcFinalAttrs(unit.data).final,
    },
    battleContext: {
      turnNumber: state.turn,
      isPlayerTurn: true, // 可根据实际情况调整
    },
  };

  const result = unit.statusContainer.tickStatuses(context);

  // 应用DOT伤害
  unit.hp -= result.damageDealt;

  // 记录日志
  result.effectLogs.forEach((log) => state.log.push(log));
}
```

### 步骤4: 替换applyStatus函数

```typescript
// 旧的:
// function applyStatus(unit: BattleUnit, effect: StatusEffect, instance: StatusInstance): boolean

// 新的:使用statusContainer.addStatus()
// 在需要应用状态时(如技能效果):
function applyStatusFromSkill(
  caster: BattleUnit,
  target: BattleUnit,
  skill: Skill,
  state: BattleState,
): void {
  if (!skill.effect) return;

  const request: StatusApplicationRequest = {
    statusKey: skill.effect,
    source: {
      sourceType: 'skill',
      sourceId: skill.id,
      sourceName: skill.name,
      casterSnapshot: snapshotUnit(caster),
    },
    potency: skill.power,
    durationOverride: skill.duration
      ? { durationType: 'turn', remaining: skill.duration, total: skill.duration }
      : undefined,
  };

  const targetSnapshot: UnitSnapshot = {
    unitId: target.id,
    currentHp: target.hp,
    currentMp: target.mp,
    maxHp: calcFinalAttrs(target.data).maxHp,
    maxMp: calcFinalAttrs(target.data).maxMp,
    baseAttributes: calcFinalAttrs(target.data).final,
  };

  const result = target.statusContainer.addStatus(request, targetSnapshot);
  state.log.push(result.message);
}
```

### 步骤5: 替换isActionBlocked函数

```typescript
// 旧的:
// function isActionBlocked(unit: BattleUnit): boolean

// 新的:
function isActionBlocked(unit: BattleUnit): boolean {
  const statuses = unit.statusContainer.getActiveStatuses();
  const context: CalculationContext = {
    target: {
      unitId: unit.id,
      currentHp: unit.hp,
      currentMp: unit.mp,
      maxHp: calcFinalAttrs(unit.data).maxHp,
      maxMp: calcFinalAttrs(unit.data).maxMp,
      baseAttributes: calcFinalAttrs(unit.data).final,
    },
  };

  const blockResult = ActionBlockerCalculator.checkMultipleStatuses(statuses, context);
  return !blockResult.canAct;
}
```

### 步骤6: 属性计算集成

修改`calculateFinalAttributes`函数(或在战斗引擎中创建新的计算函数):

```typescript
function calcFinalAttrsWithStatus(unit: BattleUnit): FinalAttributes {
  const baseAttrs = calcFinalAttrs(unit.data);
  
  const context: CalculationContext = {
    target: {
      unitId: unit.id,
      currentHp: unit.hp,
      currentMp: unit.mp,
      maxHp: baseAttrs.maxHp,
      maxMp: baseAttrs.maxMp,
      baseAttributes: baseAttrs.final,
    },
  };

  const modifications = unit.statusContainer.calculateAttributeModifications(context);

  return {
    ...baseAttrs,
    final: {
      vitality: baseAttrs.final.vitality + modifications.vitality,
      spirit: baseAttrs.final.spirit + modifications.spirit,
      wisdom: baseAttrs.final.wisdom + modifications.wisdom,
      speed: baseAttrs.final.speed + modifications.speed,
      willpower: baseAttrs.final.willpower + modifications.willpower,
    },
  };
}
```

然后在所有调用`calcFinalAttrs`的地方改为调用`calcFinalAttrsWithStatus`(需要传入unit而非data)。

### 步骤7: 战斗结束清理

在`simulateBattle`函数结束时:

```typescript
// 清除战斗状态,保留持久状态
state.player.statusContainer.clearStatusesByType(['buff', 'debuff', 'control', 'dot']);
state.opponent.statusContainer.clearStatusesByType(['buff', 'debuff', 'control', 'dot']);

// 如果需要返回持久状态给上层(副本系统):
const playerPersistentStatuses = state.player.statusContainer.toJSON()
  .filter(s => s.statusType === 'persistent');
```

### 步骤8: TurnSnapshot序列化

修改`snapshotTurn`函数以包含完整的状态信息:

```typescript
function snapshotTurn(
  turn: number,
  player: BattleUnit,
  opponent: BattleUnit,
): TurnSnapshot {
  const buildUnit = (unit: BattleUnit): TurnUnitSnapshot => ({
    hp: unit.hp,
    mp: unit.mp,
    // 旧的: statuses: Array.from(unit.statuses.keys()),
    // 新的:
    statuses: unit.statusContainer.getActiveStatuses().map(s => s.statusKey),
  });

  return {
    turn,
    player: buildUnit(player),
    opponent: buildUnit(opponent),
  };
}
```

## 第三阶段:副本系统集成

### 副本状态生成

在`lib/dungeon/service_v2.ts`的`processResources`函数中:

```typescript
import { StatusContainer, StatusApplicationRequest } from '@/engine/status';

async processResources(
  cultivatorId: string,
  resources: DungeonResourceGain[] | DungeonOptionCost[],
  type: 'gain' | 'cost',
) {
  if (type === 'cost') {
    const statusContainer = new StatusContainer();
    
    for (const cost of resources as DungeonOptionCost[]) {
      let statusKey: StatusEffect | undefined;
      let potency = cost.value;

      switch (cost.type) {
        case 'weak':
          statusKey = 'weakness';
          break;
        case 'hp_loss':
          statusKey = 'hp_deficit';
          potency = cost.value * 30; // HP损失量
          break;
        case 'artifact_damage':
          statusKey = 'artifact_damaged';
          // metadata中存储损坏的法宝ID
          break;
      }

      if (statusKey) {
        const request: StatusApplicationRequest = {
          statusKey,
          source: {
            sourceType: 'system',
            sourceName: '副本历练',
          },
          potency,
          durationOverride: {
            durationType: 'permanent',
            remaining: -1,
            total: -1,
          },
        };

        // 添加到状态容器(这里需要一个虚拟的target)
        // 实际应用在创建战斗会话时
      }
    }
  }
}
```

### 战斗会话传递

修改`lib/dungeon/types.ts`的BattleSession:

```typescript
export interface BattleSession {
  battleId: string;
  dungeonStateKey: string;
  cultivatorId: string;
  enemyData: { ... };
  playerSnapshot: {
    currentHp: number;
    currentMp: number;
    persistentStatuses?: StatusInstance[]; // 新增
  };
}
```

在创建战斗会话时传递状态,在初始化BattleUnit时加载。

## 迁移注意事项

1. **渐进式迁移**: 可以先保留旧的状态逻辑,在新旧代码间添加兼容层
2. **测试覆盖**: 每完成一个函数的替换,都应编写或运行对应的测试
3. **类型安全**: 利用TypeScript的类型检查,确保所有调用点都正确更新
4. **性能监控**: 新的状态系统增加了抽象层,需要监控是否影响战斗性能

## 后续工作

1. 完成战斗引擎的完整集成
2. 实现副本系统的状态传递
3. 编写单元测试和集成测试
4. 性能优化和缓存机制
5. 添加更多状态类型(环境状态等)
6. 实现状态协同规则
