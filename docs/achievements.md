# 成就系统

成就归属于本服角色，按角色ID独立解锁、统计和展示；名片可选零至三项。同一账号的其他角色、转世新角色不继承旧角色成就或桃李人数。角色物理删除时级联删除其解锁记录，账号注销同时清理全部角色的成就。跨服档案不携带可供客户端声明的解锁账本。

## 分层与入口

| 层 | 入口 | 职责 |
| --- | --- | --- |
| 领域模型 | `packages/game-domain/src/achievements.ts` | 定义、metric条件、可信事实、解锁事实和展示模型 |
| 内容目录 | `packages/game-content/src/achievements.ts` | 稳定成就ID、名称、条件、阈值和可选动态名称模板 |
| 纯规则 | `packages/game-rules/src/achievements.ts` | 进度计算、达标判定、永久解锁投影和文本模板 |
| 持久化 | `apps/api/src/achievements/achievement-ledger.ts` | 事务解锁、当前师徒事实和目录读取 |
| API | `apps/api/src/achievements/achievements.controller.ts` | 活跃角色读取自己的目录；没有客户端发放接口 |
| 名片 | `apps/api/src/cultivator/character-card.service.ts` | 只允许本人选择已解锁项，公开返回选定展示字段 |
| UI | `apps/web/src/components/feature/character-card/AchievementPicker.tsx` | 搜索、状态筛选、条件进度与选择操作 |

四个包通过明确的`achievements`子路径和命名导出提供API。应用不绕过包exports导入源文件。

## 当前成就

| ID | 显示名称 | 可信条件 |
| --- | --- | --- |
| `mentorship.apprentice` | `{mentorName}之徒` | 已正式建立过师徒关系 |
| `mentorship.graduates.2` | 为人师表 | 累计培养2位弟子成功出师 |
| `mentorship.graduates.6` | 循循善诱 | 累计培养6位弟子成功出师 |
| `mentorship.graduates.12` | 诲人不倦 | 累计培养12位弟子成功出师 |
| `mentorship.graduates.20` | 厚德树人 | 累计培养20位弟子成功出师 |
| `mentorship.graduates.30` | 桃李天下 | 累计培养30位弟子成功出师 |

师承条件对应`mentorship.bound`，桃李人数对应`mentorship.graduated_disciples`。桃李仅按`mentorOriginalCultivatorId`等于当前角色的`graduated`关系计数，不使用私聊、旧指导或声望余额计数。既有可信事实可以补齐成就；不会因此补发声望或世界公告。

## 扩展新成就

拜师事实仅属于原徒弟角色，角色目录从不按账号合并旧角色的拜师、毕业进度或解锁记录。

新增普通计数成就时，在内容目录注册唯一稳定ID与`requirement: { metric, target }`，并在所属服务提供该metric的权威事实。共享计算核心无需按玩法增加条件分支；目标必须是正安全整数，缺失metric按零处理，非有限或负进度不会解锁。

业务服务可在自己的事务中调用`grantAchievement(tx, { cultivatorId, achievementId, sourceKey, metadata? })`。调用方负责认证、业务完成校验与一致的账号锁顺序，不能把请求中的成就ID、数量或metric直接当作已完成事实。账本以`(cultivatorId, achievementId)`唯一，合法重试不改写首次解锁时间。

当前师徒接入通过`syncMentorshipAchievements(tx, cultivatorId)`读取原角色的关系事实：在接受拜师和出师的同一事务中同步；登录者读取目录及名片设置时也可补齐。增加其他玩法时，接入所属服务的结算事务，并扩展目录事实provider以提供锁定项的当前进度。通用函数不负责发放货币。

动态名称通过`nameTemplate`替换服务端`labels`，不执行表达式；缺失模板字段时使用基础名称。拜师成就的来源键是原师徒关系ID，账本不复制导师账号ID或道号；展示时读取关系的权威名称。导师注销后关系已匿名化，成就同步展示匿名名称，不重新泄漏旧身份。

## 名片协议

- `GET /api/achievements`：当前登录活跃角色的完整目录，含锁定状态、条件、当前进度和首次解锁时间。
- `GET /api/cultivator/card/settings`：当前角色名片设置及成就目录；补齐操作在普通事务中进行，公开名片构建保持只读。
- `PUT /api/cultivator/card/settings`：完整载荷包含`title`、`equipmentIds`、`beastIds`、`achievementIds`和`revision`。成就最多三项、不能重复；服务端重新验证解锁归属及revision。
- `GET /api/cultivator/:id/card`：只返回选定成就的`id/name/description`，保留选择顺序，不返回metadata、来源键、账号ID、未选项目或完整目录。

旧`profileCard`没有`achievementIds`时按空列表读取。名片设置内可搜索名称/条件及筛选解锁状态；实时社交通知和前台补拉只刷新成就目录，不覆盖尚未保存的名片选择。编辑器以活跃角色ID重建，切角色时清除旧角色的目录回退、未保存选择与抽屉；读取校验响应角色ID。

## 验证

纯规则测试在`packages/game-rules/src/achievements.test.ts`，覆盖五档阈值、未来metric、非法或缺失进度、动态名、永久解锁及未知旧定义。API、数据库和Web遵守项目验证规范，不增加模拟集成单元测试。

角色隔离的真实运行证据见[师徒设计第20节](mentorship-and-friends-design.md#20-成就角色隔离)；此前玩法验收保留在第19节。


## 持久化结构

成就功能尚未发布，`0077_achievements_and_graduation.sql`直接创建角色成就表，以`cultivator_id`关联角色，并以角色+成就定义建立唯一键。开发期间的旧账号成就数据只在本地整理，不保留专门的过渡迁移或账号成就归档表。
