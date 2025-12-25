# 寿元限制器使用指南

## 概述

`LifespanLimiter` 是一个基于 Redis 的寿元消耗管理工具，用于：

1. **每日寿元限制**：每个角色每天最多消耗 200 年寿元
2. **并发控制**：防止角色同时进行多个寿元消耗操作（如同时闭关）

## 核心特性

- ✅ 每日寿元上限：200 年/天（每日凌晨自动重置）
- ✅ 闭关并发锁：防止同一角色同时闭关
- ✅ 自动回滚：操作失败时自动回滚寿元消耗
- ✅ Redis 存储：高性能、支持分布式部署

## 快速使用

### 1. 导入工具类

\`\`\`typescript import { getLifespanLimiter } from '@/lib/redis/lifespanLimiter'; \`\`\`

### 2. 使用方式 A：手动控制（推荐用于复杂场景）

\`\`\`typescript export async function POST(request: NextRequest) { const limiter = getLifespanLimiter(); let cultivatorId: string | undefined; let years = 0; let lockAcquired = false;

try { // ... 参数解析和验证 ...

    // 1️⃣ 获取操作锁（可选，用于防止并发）
    lockAcquired = await limiter.acquireRetreatLock(cultivatorId);
    if (!lockAcquired) {
      return NextResponse.json(
        { error: '角色正在闭关中，请稍后再试' },
        { status: 409 }
      );
    }

    // 2️⃣ 检查并消耗寿元
    const lifespanCheck = await limiter.checkAndConsumeLifespan(
      cultivatorId,
      years
    );
    if (!lifespanCheck.allowed) {
      return NextResponse.json(
        {
          error: lifespanCheck.message,
          remaining: lifespanCheck.remaining,
          consumed: lifespanCheck.consumed,
        },
        { status: 400 }
      );
    }

    // 3️⃣ 执行业务逻辑
    // ... 你的业务代码 ...

    // 4️⃣ 如果操作失败，回滚寿元消耗
    if (!operationSuccess) {
      await limiter.rollbackLifespan(cultivatorId, years);
      throw new Error('操作失败');
    }

    return NextResponse.json({ success: true });

} catch (err) { // 5️⃣ 错误处理时也要回滚 if (cultivatorId && years > 0) { await limiter.rollbackLifespan(cultivatorId, years); } throw err; } finally { // 6️⃣ 始终释放锁 if (lockAcquired && cultivatorId) { await limiter.releaseRetreatLock(cultivatorId); } } } \`\`\`

### 3. 使用方式 B：自动包装（推荐用于简单场景）

\`\`\`typescript const limiter = getLifespanLimiter();

// 使用 withRetreatLock 自动处理锁和寿元检查 const result = await limiter.withRetreatLock( cultivatorId, years, async () => { // 你的业务逻辑 // 此时已经获取了锁，并且已经通过寿元检查 const result = await performOperation(cultivator); return result; } ); \`\`\`

## API 参考

### checkAndConsumeLifespan(cultivatorId, years)

检查并消耗寿元。

**参数：**

- `cultivatorId: string` - 角色ID
- `years: number` - 需要消耗的年数

**返回：** \`\`\`typescript { allowed: boolean; // 是否允许消耗 remaining: number; // 剩余可用寿元 consumed: number; // 今日已消耗寿元 message?: string; // 错误消息（如果不允许）} \`\`\`

### rollbackLifespan(cultivatorId, years)

回滚寿元消耗（用于操作失败时）。

**参数：**

- `cultivatorId: string` - 角色ID
- `years: number` - 需要回滚的年数

### acquireRetreatLock(cultivatorId, ttl?)

尝试获取闭关锁。

**参数：**

- `cultivatorId: string` - 角色ID
- `ttl?: number` - 锁的过期时间（秒），默认 300 秒

**返回：** `boolean` - 是否成功获取锁

### releaseRetreatLock(cultivatorId)

释放闭关锁。

**参数：**

- `cultivatorId: string` - 角色ID

### getConsumedLifespan(cultivatorId)

获取今日已消耗的寿元。

**参数：**

- `cultivatorId: string` - 角色ID

**返回：** `number` - 已消耗的年数

### getRemainingLifespan(cultivatorId)

获取今日剩余可用寿元。

**参数：**

- `cultivatorId: string` - 角色ID

**返回：** `number` - 剩余可用年数

### isRetreatLocked(cultivatorId)

检查是否持有闭关锁。

**参数：**

- `cultivatorId: string` - 角色ID

**返回：** `boolean` - 是否正在闭关

### withRetreatLock(cultivatorId, years, operation)

安全执行闭关操作（自动加锁解锁和寿元检查）。

**参数：**

- `cultivatorId: string` - 角色ID
- `years: number` - 消耗年数
- `operation: () => Promise<T>` - 要执行的操作

**返回：** `Promise<T>` - 操作结果

**抛出：**

- `Error` - 如果获取锁失败或寿元不足

## 在其他场景中使用

### 副本探索（Dungeon）

如果副本选项包含 `lifespan_loss` 消耗，应该在处理前检查寿元限制：

\`\`\`typescript // 在 lib/dungeon/service_v2.ts 的 processResources 方法中 async processResources( cultivatorId: string, resources: DungeonResourceGain[] | DungeonOptionCost[], type: 'gain' | 'cost', ) { if (type === 'cost') { // 检查是否有寿元消耗 const lifespanCost = resources.find(r => r.type === 'lifespan_loss'); if (lifespanCost) { const limiter = getLifespanLimiter(); const check = await limiter.checkAndConsumeLifespan( cultivatorId, lifespanCost.value ); if (!check.allowed) { throw new Error(check.message || '今日寿元消耗已达上限'); } } } // ... 其他资源处理 ... } \`\`\`

### 战斗后消耗

如果战斗会消耗寿元，也应该使用此工具：

\`\`\`typescript // 战斗结算时 if (battleResult.lifespanLoss > 0) { const limiter = getLifespanLimiter(); const check = await limiter.checkAndConsumeLifespan( cultivatorId, battleResult.lifespanLoss ); if (!check.allowed) { // 处理寿元不足的情况 } } \`\`\`

### 炼丹炼器

如果炼丹炼器会消耗寿元（闭关炼制），同样适用：

\`\`\`typescript const limiter = getLifespanLimiter(); const check = await limiter.checkAndConsumeLifespan( cultivatorId, craftingYears ); if (!check.allowed) { return { error: check.message }; } \`\`\`

## 查询 API

可以通过以下 API 查询角色的寿元消耗状态：

\`\`\` GET /api/cultivators/lifespan-status?cultivatorId={id} \`\`\`

**响应示例：** \`\`\`json { "success": true, "data": { "cultivatorId": "xxx", "dailyLimit": 200, "consumed": 50, "remaining": 150, "isInRetreat": false } } \`\`\`

## 注意事项

1. **并发安全**：闭关锁默认过期时间为 300 秒（5 分钟），防止死锁
2. **自动重置**：寿元消耗每日凌晨自动重置
3. **回滚机制**：操作失败时务必调用 `rollbackLifespan`，否则会造成寿元统计错误
4. **锁释放**：在 `finally` 块中释放锁，确保异常情况下也能释放

## 示例：完整的闭关流程

参考实现：[app/api/cultivator/retreat/route.ts](file:///Users/churcht/vsProjects/wanjiedaoyou/app/api/cultivator/retreat/route.ts) \`\`\`typescript // 完整示例已在闭关 API 中实现 \`\`\`
