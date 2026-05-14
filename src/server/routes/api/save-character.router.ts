import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  deleteTempData,
  getTempCharacter,
  getTempFates,
} from '@server/lib/repositories/redisCultivatorRepository';
import { MailService } from '@server/lib/services/MailService';
import {
  createCultivator,
  hasActiveCultivator,
} from '@server/lib/services/cultivatorService';
import { Hono } from 'hono';
import { z } from 'zod';

const SaveCharacterSchema = z.object({
  tempCultivatorId: z.string(),
  selectedFateIndices: z.array(z.number()).length(3),
});

const router = new Hono<AppEnv>();

router.post('/', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { tempCultivatorId, selectedFateIndices } = SaveCharacterSchema.parse(
    await c.req.json(),
  );

  if (await hasActiveCultivator(user.id)) {
    return c.json({ error: '您已经拥有一位道身，无法创建新的道身' }, 400);
  }

  const [cultivator, availableFates] = await Promise.all([
    getTempCharacter(tempCultivatorId),
    getTempFates(tempCultivatorId),
  ]);

  if (!cultivator) {
    return c.json({ error: '角色数据已过期，请重新生成' }, 400);
  }

  if (!availableFates) {
    return c.json({ error: '气运数据丢失，请重新生成' }, 400);
  }

  const selectedFates = selectedFateIndices
    .filter((idx) => idx >= 0 && idx < availableFates.length)
    .map((idx) => availableFates[idx]);

  if (selectedFates.length !== 3) {
    return c.json({ error: '气运选择有误' }, 400);
  }

  cultivator.pre_heaven_fates = selectedFates;
  const newCultivator = await createCultivator(user.id, cultivator);

  await MailService.sendMail(
    newCultivator.id!,
    '仙缘初结·新手礼包',
    '恭喜道友踏入仙途！大道争锋，财侣法地缺一不可。这有些许灵石，聊表心意，助道友仙路顺遂。',
    [{ type: 'spirit_stones', name: '灵石', quantity: 20000 }],
    'reward',
  );

  await deleteTempData(tempCultivatorId);

  return c.json({ success: true });
});

export default router;
