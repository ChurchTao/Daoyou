import { Injectable } from '@nestjs/common';
import { redis } from '@server/lib/redis/index.js';
import { parseRedisJson } from '@server/lib/redis/json.js';
import { generateAiObject } from '@server/utils/aiClient.js';
import {
  getDivineFortunePrompt,
  getRandomFallbackFortune,
} from '@server/utils/divineFortune.js';
import { DivineFortuneSchema, type DivineFortune } from '@daoyou/game-domain/divination';
const CACHE_KEY = 'divine_fortune_data';
const CACHE_TTL = 60 * 60 * 24;
@Injectable()
export class DivineFortuneService {
  async read() {
    try {
      const cachedRaw = await redis.get(CACHE_KEY);
      const cachedFortune = parseRedisJson<DivineFortune>(cachedRaw, CACHE_KEY);
      if (cachedRaw && !cachedFortune) await redis.del(CACHE_KEY);
      if (cachedFortune)
        return { success: true, data: cachedFortune, cached: true };
      const [systemPrompt, userPrompt] = getDivineFortunePrompt();
      const aiResponse = await generateAiObject({
        system: systemPrompt,
        prompt: userPrompt,
        schema: DivineFortuneSchema,
        name: 'DivineFortune',
        sceneId: 'divine-fortune',
      });
      const fortune = aiResponse.output;
      await redis.set(CACHE_KEY, JSON.stringify(fortune), 'EX', CACHE_TTL);
      return { success: true, data: fortune };
    } catch (error) {
      console.error('天机推演 API 错误:', error);
      return {
        success: true,
        data: getRandomFallbackFortune(),
        fallback: true,
      };
    }
  }
}
