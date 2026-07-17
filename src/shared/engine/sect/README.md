# 宗门系统架构

宗门系统采用“注册表 + 运行时门面 + 构建器 + 插件流水线 + 策略”的组合架构。通用核心只认识稳定字符串 ID 和插件契约，任何具体宗门、流派、节点都只能存在于 `content`。

## 目录职责

- `core/domain`：序列化定义、持久化状态、编译结果和上下文值对象。
- `core/plugin`：`BaseSectModule`、`BaseSectPathModule`、节点插件和准入、试炼策略契约。
- `core/authoring`：宗门神通、战斗效果、法力消耗和战术候选构造器。
- `core/compilation`：`SectBuildBuilder` 和统一编译导演 `SectCompiler`。
- `core/progression`：可注入成长策略、心法等级上限、成本和有序层解锁规则。
- `core/validation`：定义、组合、编译契约和持久化状态校验流水线。
- `core/runtime`：`SectRegistry` 与客户端、服务端共用的 `SectRuntimeFacade`。
- `core/presentation`：神通效果说明、心法属性投影和四槽装配等纯逻辑。
- `content/productionRuntime.ts`：生产模块唯一组合根。
- `content/lingxiao`：凌霄基础传承和快剑、重剑两个流派插件。
- `testing/fixtures`：不会进入生产目录的扩展性宗门。

根目录只保留本说明、公共 `index.ts` 和上述分层目录。通用能力从 `@shared/engine/sect` 导入；生产运行时从 `@shared/engine/sect/content` 导入。

## 编译流程

```text
CultivatorSectState
  -> SectRuntimeFacade
  -> SectRegistry.require(sectId)
  -> BaseSectModule.createBaseBuilder
  -> BaseSectPathModule.compileVariants
  -> SectNodePlugin.apply（按层级和声明顺序）
  -> SectBuildBuilder.build
  -> AbilityFactory 契约校验
  -> SectCompiledBuild
       -> battle-v5 战斗投影
       -> ResolvedSectAbility 展示投影
```

战斗和页面详情必须读取同一个 `SectCompiledBuild`。Service、Repository、API、UI 和 battle adapter 不得重新解释宗门资源、倍率或节点效果。

## 对象与模式

- `SectRegistry` 使用注册表模式完成模块发现和 ID 分派。
- `SectRuntimeFacade` 使用门面模式统一校验、编译、战斗投影和详情解析。
- `BaseSectModule`、`BaseSectPathModule` 使用模板方法固定插件生命周期，并由流派模块自动生成序列化流派定义。
- `SectBuildBuilder` 使用构建器模式提供受控修改面，节点不能直接共享可变 `AbilityConfig`。
- `SectNodePlugin` 是定义与行为一体的装饰器；编译器将已选节点组成稳定流水线。
- 战术、准入和试炼通过策略对象注入，通用层不根据内容 ID 选择实现。
- 校验器使用组合规则流水线，分别检查定义、对象组合、运行时产物和持久化状态。

设计模式只用于封装变化方向。纯定义和值对象继续使用 TypeScript 数据结构，不为形式上的“面向对象”制造空类。

## 新增宗门

1. 在 `content/<sect>` 定义六本心法、基础神通和稳定内容 ID。
2. 继承 `BaseSectModule`，实现基础编译并注入成长、准入、试炼策略和流派模块。
3. 每个流派继承 `BaseSectPathModule`，声明有序层、基础变体、战术策略和节点插件。
4. 节点使用 `ConfiguredSectNodePlugin` 或专用子类，将定义与 `apply` 行为放在一起。
5. 在 `content/productionRuntime.ts` 注册正式宗门。除这个组合根外，不修改通用层。

## 新增流派或节点

- 新流派只新增所属目录并加入宗门构造参数，不修改 Compiler、Registry、Service、Repository、API 或 UI。
- 新节点只新增一个节点插件并加入流派节点列表，不在流派基础编译器增加节点 ID 判断。
- 多个节点修改同一组神通时，建立流派私有 Build Facade，用语义特征组合变化；禁止恢复 `nodes.has(id)` 中央分派。
- 节点每次应用必须造成可观察的最终运行时变化，空实现会在注册时失败。

## 边界约束

- 每个宗门固定六本心法，每本至少拥有一个基础神通。
- 流派层数与每层节点数由内容声明；层 ID、顺序和节点归属必须稳定且可校验。
- 玩家只保存已按顺序解锁的层 ID；流派编译器不得从等级推导倍率或层级。
- 四个主动槽固定、不可重复，只能装配已解锁主动神通。
- 每个流派独立保存等级、战术和三套参悟方案，只能激活一个流派。
- 未注册 ID、未知配置版本和非法持久化状态必须明确失败。
- battle-v5 运行时标签只能通过 `GameplayTags` 生成。
- `core` 禁止依赖 `content`，生产内容禁止回流到通用入口。
- 宗门代码的架构注释、业务原因和扩展约束统一使用中文。
