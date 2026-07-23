# 宗门内容接入指南

普通宗门共享入门文戏、任务、晋升、设施、经济、建设、收益和准入流程，只定义身份、六本心法、神通、流派、参悟节点与玩家可见的入门演出。完整参考实现位于 `src/shared/engine/sect/testing/fixtures/FixtureSectModule.ts`，且不会进入生产目录。

## 目录模板

```text
src/shared/engine/sect/content/<sect-id>/
  <SectName>SectModule.ts
  definition.ts
  ids.ts
  base/<SectName>BaseCompiler.ts
  paths/<path-id>/<PathName>PathModule.ts
  paths/<path-id>/nodes/*.ts
  paths/<path-id>/variants.ts
  organization/theme.ts        # 可选，仅换任务和组织称谓
  presentation.ts              # 生产宗门必填入门演出，可继续覆盖前端主题
```

## 稳定 ID 与标准规则

- 宗门、心法、神通、流派、层、节点和战术 ID 使用稳定的小写英文与连字符，不使用展示名称或版本号。
- 战斗资源 ID 使用 `sect.<sect-id>.<resource>` 命名空间，并且全宗门唯一。
- ID 一旦持久化就不可随意修改。修改持久 ID 或提高 `configVersion` 前必须单独设计数据迁移；本轮没有实现自动或离线迁移。
- 运行时标签必须由 `GameplayTags` 构造，不手写 `Ability.*`、`Buff.*` 或 `Status.*`。
- 标准宗门恰好定义六本心法、一本主心法、一个默认能力和一个战斗资源。四个主动槽与三套参悟方案由 `StandardSectRules` 管理。

## 心法与能力定义

`definition.ts` 导出 `SectDefinitionWithoutPaths`。能力使用辨识联合，不能再用布尔字段表达是否占主动栏：

```ts
const abilities: SectAbilityDefinition[] = [
  {
    id: 'plain-flame',
    kind: 'default',
    baseName: '引火诀',
    description: '凝聚一缕真火。',
    role: 'generator',
    unlock: { type: 'method', methodId: 'fire-canon', level: 1 },
    mpCost: 0,
    cooldown: 0,
  },
  {
    id: 'flame-domain',
    kind: 'active',
    baseName: '炎域',
    description: '以真火覆盖敌阵。',
    role: 'finisher',
    unlock: { type: 'method', methodId: 'fire-canon', level: 10 },
    mpCost: 60,
    cooldown: 4,
  },
  {
    id: 'ember-body',
    kind: 'passive',
    baseName: '余烬护体',
    description: '激活流派后获得常驻守护。',
    role: 'defensive',
    unlock: { type: 'active_path', pathId: 'ember-path' },
    visibility: 'internal',
  },
];
```

解锁对象只有 `method`、`active_path` 和 `always` 三种。`visibility: 'internal'` 的能力参与战斗投影，但不显示在神通列表。

## 编译神通

所有宗门能力必须通过 `SectAbilityFactory`，最终仍由 battle-v5 `AbilityFactory` 校验。Factory 会递归分析效果，生成伤害、治疗、控制、伤害通道和目标范围标签。

```ts
builder.setAbility(
  'flame-domain',
  new SectAbilityFactory(definition.id).active({
    definition: activeDefinition,
    targetPolicy: { team: 'enemy', scope: 'aoe', maxTargets: 3 },
    effects: [
      {
        type: 'damage',
        params: {
          value: { attribute: AttributeType.MAGIC_ATK, coefficient: 1.2 },
          damageType: DamageType.MAGICAL,
        },
      },
    ],
  }),
);
```

`targetPolicy` 对所有主动和默认能力必填，作者必须明确敌方、友方、自身以及单体、范围或随机目标。目标标签只从该策略推导。AI 意图默认从效果分析器的 `capabilities.selectionProfile` 推导，治疗会得到 `heal_hp`，控制会得到 `control`；显式 `selectionProfile` 优先。`role` 只生成宗门职责标签，不参与 AI 意图猜测。纯资源或分析器无法识别的复杂能力必须显式提供 `selectionProfile`，否则注册失败。

默认能力可以使用 `always` 或心法解锁，但不能依赖激活流派。入宗心法必须解锁默认能力。

## 入门演出

生产宗门在 `SectPresentationTheme.onboarding` 中提供玩家摘要、三个特色词和 `NarrativePerformanceScript`。脚本按幕声明场景、正文、可选人物台词与背景焦点；通用演出舞台负责显字、前后切幕和终幕拜师。

入门文案只使用世界内语言，不展示等级、倍率、冷却、消耗、配置、构筑或其他实现术语。主视觉必须是无文字的本地资源，并提供替代文本；加入宗门仍由服务端准入策略和幂等事务兜底，不以浏览器演出状态作为安全边界。

## 流派与节点

流派继承 `BaseSectPathModule`，只负责初始化、战术和可选 finalize：

```ts
class EmberPathModule extends BaseSectPathModule {
  protected initializeBuild(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ) {
    initializeEmberBuild(context, builder);
  }

  protected finalizeBuild(
    _context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ) {
    emberBuild(builder).finalize();
  }

  createSelectionStrategy(tacticId: string) {
    return new EmberSelectionStrategy(tacticId);
  }
}
```

节点通过 `ConfiguredSectNodePlugin` 或独立插件修改 Builder。节点只开启领域特征或添加局部被动，不在流派编译器里按节点 ID 集中 `if/switch`。Build Facade 的 `enable()` 只收集特征，能力和资源在 `finalize()` 中重建一次。

## 组合与注册

普通宗门继承 `StandardSectModule`：

```ts
export class EmberSectModule extends StandardSectModule {
  constructor() {
    super(EMBER_BASE_DEFINITION, [EMBER_SWIFT_PATH, EMBER_GUARD_PATH], {
      organizationTheme: EMBER_ORGANIZATION_THEME,
    });
  }

  protected compileBase(
    context: SectProjectionContext,
    builder: SectBuildBuilder,
  ) {
    compileEmberBase(context, builder);
  }
}
```

主题只能覆盖任务文案、商品奖励展示、敌人名称和设施称谓，不能替换普通宗门的核心流程策略。不提供主题时使用通用组织展示。

## 可选前端主题

普通宗门不提供主题也会获得完整的中性场景、设施导航、加载文案和术语。需要换皮时，在内容目录导出纯数据 `SectPresentationTheme`：

```ts
export const EMBER_PRESENTATION: SectPresentationTheme = {
  sectId: 'ember-sect',
  map: {
    image: '/assets/sect/ember-map.webp',
    alt: '赤霄宗设施舆图',
    // 自定义地图必须整体提供热点；数组不会与默认热点逐项合并。
    hotspots: EMBER_MAP_HOTSPOTS,
  },
  facilityLabels: { archive: '火藏阁', workshop: '炎工坊' },
  scenes: {
    archive: {
      title: '火藏阁',
      description: '历代火法依卷次陈列。',
      loadingText: '火纹卷册正在展开……',
    },
  },
  terms: {
    pathChanges: '火脉变化',
    meridianPractice: '炎路参悟',
    abilityChanges: '术式变化',
  },
};
```

对象字段按键覆盖默认值，热点数组整体替换。空字符串、主题宗门 ID 不一致、重复热点和缺少替代文本或热点的自定义地图会在启动时失败。

最后只在 `src/shared/engine/sect/content/productionRuntime.ts` 的 `PRODUCTION_SECTS` 中加入一个条目：

```ts
export const PRODUCTION_SECTS = createProductionSectCatalog([
  { module: EMBER_MODULE, presentation: EMBER_PRESENTATION },
]);
```

该目录同时是 Runtime、服务端已知宗门、标准组织玩法和前端展示的宗门 ID 真相。没有前端主题时只写 `{ module: EMBER_MODULE }`。

标准宗门不需要空服务端 manifest、前端文件或专属地图。只有新增自定义执行器、结算、奖励、捐献类型或特殊任务 React 交互时才注册额外插件；插件必须引用生产目录中的已知宗门 ID。普通页面、地图和设施展示不使用插件注册。

## battle-v5 边界与原语准入

battle-v5 只理解伤害、治疗、Buff、层数、资源、命中、行动、事件、条件和监听预算等通用战斗事实。宗门语义、节点开关、元素组合、展示颜色和复杂效果编排必须留在 `content/<sect-id>`，并在编译期产出标准 `AbilityConfig`、`BuffConfig` 和有限个 effect plan。

当运行时只存在少量离散分支时，优先编译固定 plan。例如“目标四层或五层时使用不同终结系数”应生成两个固定伤害层，并在施法准备阶段按通用层数条件选定；不要让 DamageEffect 读取任意状态的实时层数。不同历史状态优先使用内容层隐藏 Buff marker 与通用 runtime counter；展示差异只进入内容展示数据或既有结构化 `cause`，不得穿透伤害事件与 React 样式字段。

任何新增 battle-v5 原语的设计稿必须逐项回答：

1. 现有 Effect、Listener 和 Condition 为什么不能组合完成？
2. 为什么不能在宗门编译期展开为有限个固定 plan？
3. 为什么不能用隐藏 Buff、`GameplayTags` 或通用 counter 表达？
4. 可接受的近似效果是什么，为什么仍不能满足？
5. 是否已有第二个独立生产消费者？
6. 默认值是否严格保持已有内容行为？
7. 是否有完全不引用宗门 ID 的原子测试？
8. 是否穿透 DamageSystem、Unit、行动流、胜负、持久化或展示层？

已有两个独立生产消费者，或修复明确的全局战斗不变量时，才可考虑增加通用原语。只有一个宗门且存在近似组合方案时，应采用内容层组合；涉及单位模型、目标、胜负、持久化或伤害主管道时必须单独立项。“未来可能复用”不能单独作为准入理由。

## 禁止事项

- 不复制 `StandardSectOrganizationModule`，不替换普通宗门核心组织策略。
- 不绕过 `SectAbilityFactory` 或 battle-v5 `AbilityFactory`。
- 不恢复 `occupiesActiveSlot`、独立 `passives` 或构造函数默认攻击参数。
- 不在页面逐个调用单能力编译，使用 Runtime 批量解析。
- 不在流派编译器按节点 ID 集中分派。
- 不手写运行时 GameplayTag。
- 不修改宗门路由页面、导航或共享组件来适配新宗门；展示差异只能进入 `SectPresentationTheme`。
- 不在前端写具体宗门 ID、固定神通数量或固定流派层数。
- 不为单个宗门增加同义的能力生命周期阶段、动态读取其他 Buff 内部配置的效果或伤害展示色字段。

## 验证

```bash
bunx vitest run src/shared/engine/sect
bunx vitest run src/shared/engine/battle-v5/tests
bun run lint
bun run test
bun run build
```

注册期会编译基础态、流派基础态、单节点态、每层首节点完整方案，以及固定其他层首节点后逐个替换当前层节点的代表组合。复杂宗门仍应补充专属节点矩阵与固定种子平衡测试。
