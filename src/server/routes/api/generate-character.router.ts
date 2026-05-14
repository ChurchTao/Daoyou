import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { saveTempCharacter } from '@server/lib/repositories/redisCultivatorRepository';
import { generateCultivatorFromAI } from '@server/utils/characterEngine';
import { Hono } from 'hono';
import { z } from 'zod';

const MIN_PROMPT_LENGTH = 2;
const MAX_PROMPT_LENGTH = 200;

const GenerateCharacterSchema = z.object({
  userInput: z.string(),
});

const countChars = (input: string): number => Array.from(input).length;

const router = new Hono<AppEnv>();

router.post('/', requireUser(), async (c) => {
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

  const userInput = parsed.data.userInput.trim();
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

  const { cultivator } = await generateCultivatorFromAI(userInput);
  const tempCultivatorId = await saveTempCharacter(cultivator);

  return c.json({
    success: true,
    data: {
      cultivator,
      tempCultivatorId,
    },
  });
});

export default router;
