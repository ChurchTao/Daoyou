import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { getRequestIp } from '@server/lib/http/requestIp';
import {
  consumeCharacterGenerationQuota,
  getCharacterGenerationQuota,
} from '@server/lib/redis/characterGenerationLimiter';
import { saveTempCharacter } from '@server/lib/repositories/redisCultivatorRepository';
import { generateCultivatorFromAI } from '@server/utils/characterEngine';
import { normalizeFreeformLlmInput } from '@server/utils/llmPayload';
import {
  CHARACTER_GENERATION_LIMIT_REACHED_CODE,
  type CharacterGenerationQuota,
  type CharacterGenerationQuotaResponse,
  type GenerateCharacterResponse,
} from '@shared/contracts/character-generation';
import { Hono } from 'hono';
import { z } from 'zod';

const MIN_PROMPT_LENGTH = 2;
const MAX_PROMPT_LENGTH = 200;

const GenerateCharacterSchema = z.object({
  userInput: z.string(),
});

const countChars = (input: string): number => Array.from(input).length;

function getQuotaExceededMessage(quota: CharacterGenerationQuota): string {
  switch (quota.limitedBy) {
    case 'email':
      return '该邮箱今日角色推演次数已用尽（每日限 6 次），请明日再试。';
    case 'ip':
      return '当前网络今日角色推演次数已用尽（每日限 6 次），请明日再试。';
    case 'both':
      return '该邮箱与当前网络今日角色推演次数均已用尽，请明日再试。';
    default:
      return '今日角色推演次数已用尽，请明日再试。';
  }
}

const router = new Hono<AppEnv>();

router.get('/quota', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const quota = await getCharacterGenerationQuota({
    email: user.email,
    ip: getRequestIp(c),
  });

  return c.json<CharacterGenerationQuotaResponse>({
    success: true,
    data: {
      quota,
    },
  });
});

router.post('/', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const parsed = GenerateCharacterSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: '请求参数格式错误，请重新输入角色描述。',
      },
      400,
    );
  }

  const userInput = normalizeFreeformLlmInput(parsed.data.userInput);
  const promptLength = countChars(userInput);

  if (promptLength < MIN_PROMPT_LENGTH) {
    return c.json(
      {
        success: false,
        error: `角色描述至少需要 ${MIN_PROMPT_LENGTH} 个字。`,
      },
      400,
    );
  }

  if (promptLength > MAX_PROMPT_LENGTH) {
    return c.json(
      {
        success: false,
        error: `角色描述过长（当前 ${promptLength} 字，最多 ${MAX_PROMPT_LENGTH} 字）。`,
        code: 'PROMPT_TOO_LONG',
        details: {
          currentLength: promptLength,
          maxLength: MAX_PROMPT_LENGTH,
        },
      },
      422,
    );
  }

  const quotaResult = await consumeCharacterGenerationQuota({
    email: user.email,
    ip: getRequestIp(c),
  });

  if (!quotaResult.allowed) {
    return c.json(
      {
        success: false,
        code: CHARACTER_GENERATION_LIMIT_REACHED_CODE,
        error: getQuotaExceededMessage(quotaResult.quota),
        quota: quotaResult.quota,
      },
      429,
    );
  }

  const { cultivator } = await generateCultivatorFromAI(userInput);
  const tempCultivatorId = await saveTempCharacter(cultivator);

  return c.json<GenerateCharacterResponse>({
    success: true,
    data: {
      cultivator,
      tempCultivatorId,
      quota: quotaResult.quota,
    },
  });
});

export default router;
