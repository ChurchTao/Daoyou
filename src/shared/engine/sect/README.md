# Sect Architecture

宗门系统采用 **Registry + Facade + Strategy + Template Method + Repository** 的组合架构。共享内核只认识接口和字符串 ID；具体宗门、流派和节点内容不能进入通用分派逻辑。

## Runtime flow

```text
CultivatorSectState
  -> SectRuntimeFacade (统一校验入口)
  -> SectRegistry (按 sectId 分派模块)
  -> SectCompiler (编译基础宗门)
  -> SectPathModule (编译当前流派变体)
  -> SectNodeContribution[] (按层级与定义顺序合成)
  -> SectCompiledBuild
       -> battle-v5 projection
       -> ResolvedSectAbility presentation
```

战斗和 UI 必须消费同一个 `SectCompiledBuild`。禁止在 UI、Service 或 battle adapter 中重新解释流派倍率、资源或节点效果。

## Directory ownership

- `types.ts`：纯领域契约、持久化状态和插件接口。
- `compiler.ts`：编译导演；只负责稳定顺序、贡献合成和最终展示归一化。
- `pathModule.ts`：流派插件模板方法，将确定性快照转换为受控节点贡献。
- `registry.ts`：模块注册、契约验证和持久化结构验证。
- `runtimeFactory.ts`：客户端与服务端共用的运行时 Facade。
- `catalog.ts`：唯一生产模块目录。
- `progression.ts`：通用升级、解锁与经脉门槛规则。
- `guide.ts`：纯展示辅助逻辑，不包含宗门内容分支。
- `methodModifiers.ts`：心法固定属性投影。
- `content/lingxiao/definition.ts`：凌霄六心法、九个稳定基础法术和入宗定义。
- `lingxiaoModule.ts`：凌霄组合根，只组装基础定义与流派模块。
- `lingxiaoSwiftPath.ts` / `lingxiaoHeavyPath.ts`：各自拥有定义、节点、编译器和策略入口。
- `content/lingxiao/combat/`：按基础、快剑、重剑拆分的 battle-v5 内容编译器。
- `content/lingxiao/strategy/`：流派独立的自动战术策略。
- `combatProjection.ts`、`selectionStrategy.ts`、`lingxiao.ts`：稳定公共导出面，不承载实现。
- `testing/`：不会进入生产目录的扩展性夹具。

## Extension rules

新增宗门：

1. 实现一个 `SectModule`，包含纯定义、基础编译、准入和试炼场景。
2. 为每个流派提供独立 `SectPathModule`。
3. 在 `catalog.ts` 注册宗门模块。
4. 不修改 Compiler、Registry、Service、Repository、API、battle adapter 或 UI。

新增流派：

1. 继承 `DeterministicSectPathModule`。
2. 在同一所有权目录定义流派、十八节点、变体编译和策略。
3. 将实例加入所属宗门的 `paths` 组合表。
4. 不在共享代码增加流派 ID 判断。

## Invariants

- 每宗门恰好六本心法，每本至少关联一个基础法术。
- 每流派六层、每层三个节点；定义和行为必须一一对应。
- 节点只能产生受控 `SectNodeContribution`，空实现无法注册。
- 四个主动槽固定、不可重复、只能装配已解锁主动法术。
- 每流派独立保存等级、战术和三套经脉方案；只能激活一个流派。
- 未注册 ID、非法状态和未知 `configVersion` 必须明确失败，禁止内容回退。
- 运行时标签只能由 `GameplayTags` 构造。
