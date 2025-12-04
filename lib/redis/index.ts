import { createClient } from 'redis';

// Use the exact return type of `createClient` to avoid mismatched Redis typings
type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;

/**
 * 获取 Redis 客户端（单例）
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (!redisClient) {
    const client = createClient({
      url: process.env.REDIS_URL,
      // 可选：添加密码、TLS 等配置
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await client.connect();
    redisClient = client;
  }

  // Non-null assertion is safe here because we just initialised it above
  return redisClient!;
}

// 如果你希望直接导出已连接的实例（适用于确定只在服务端使用）
// 注意：不要在客户端组件中导入此模块！
export const redis = await getRedisClient();
