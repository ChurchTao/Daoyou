import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export { getLifespanLimiter, LifespanLimiter } from './lifespanLimiter';
export { redis };
