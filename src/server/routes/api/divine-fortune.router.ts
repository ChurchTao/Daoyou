import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import type { AppEnv } from '@server/lib/hono/types';
import { text } from '@server/utils/aiClient';
import {
  getDivineFortunePrompt,
  getRandomFallbackFortune,
  type DivineFortune,
} from '@server/utils/divineFortune';
import { Hono } from 'hono';

const CACHE_KEY = 'divine_fortune_data';
const CACHE_TTL = 60 * 60 * 24;

const router = new Hono<AppEnv>();

router.get('/', async (c) => {
  try {
    const cachedRaw = await redis.get(CACHE_KEY);
    const cachedFortune = parseRedisJson<DivineFortune>(cachedRaw, CACHE_KEY);
    if (cachedRaw && !cachedFortune) {
      await redis.del(CACHE_KEY);
    }

    if (cachedFortune) {
      return c.json({
        success: true,
        data: cachedFortune,
        cached: true,
      });
    }

    const [systemPrompt, userPrompt] = getDivineFortunePrompt();
    const aiResponse = await text(systemPrompt, userPrompt, true);

    let fortune: DivineFortune;
    try {
      fortune = JSON.parse(aiResponse.text);

      if (!fortune.fortune || !fortune.hint) {
        throw new Error('Invalid fortune format');
      }

      await redis.set(CACHE_KEY, JSON.stringify(fortune), 'EX', CACHE_TTL);
    } catch (parseError) {
      console.warn('Failed to parse AI response, using fallback:', parseError);
      fortune = getRandomFallbackFortune();
    }

    return c.json({
      success: true,
      data: fortune,
    });
  } catch (error) {
    console.error('天机推演 API 错误:', error);
    return c.json({
      success: true,
      data: getRandomFallbackFortune(),
      fallback: true,
    });
  }
});

export default router;
