import { gte, isNotNull, or } from 'drizzle-orm';
import { db } from '../drizzle/db';
import { cultivators } from '../drizzle/schema';
import { SPECIAL_TALISMAN_CONFIG } from '../repositories/talismanRepository';
import { MailAttachment, MailAttachmentType, MailService } from './MailService';

const attachments: MailAttachment[] = [
  {
    type: 'consumable' as MailAttachmentType,
    name: '天机逆命符',
    quantity: 3,
    data: SPECIAL_TALISMAN_CONFIG.天机逆命符,
  },
  {
    type: 'consumable' as MailAttachmentType,
    name: '悟道演法符',
    quantity: 3,
    data: SPECIAL_TALISMAN_CONFIG.悟道演法符,
  },
  {
    type: 'consumable' as MailAttachmentType,
    name: '神通衍化符',
    quantity: 3,
    data: SPECIAL_TALISMAN_CONFIG.神通衍化符,
  },
];

describe('MailService', () => {
  // it('should send a system mail', async () => {
  //   // 查询所有 title 不是null的角色
  //   const cultivators = await db().query.cultivators.findMany({
  //     where: (cultivators, { isNotNull }) => isNotNull(cultivators.title),
  //   });
  //   cultivators.forEach(async (cultivator) => {
  //     const cultivatorId = cultivator.id;
  //     const title = '系统测试邮件';
  //     const content = '这是一封测试邮件，包含20000灵石和几样材料。';
  //     const material1: Material = {
  //       name: '天火陨铁',
  //       rank: '天品',
  //       element: '火',
  //       type: 'ore',
  //       description:
  //         '天外飞来的神秘陨铁，蕴含着天火之力，可以炼制出更高级的材料。',
  //       details: {},
  //       quantity: 1,
  //     };
  //     const material2: Material = {
  //       name: '地心泉水',
  //       rank: '地品',
  //       element: '水',
  //       type: 'aux',
  //       description:
  //         '地心泉水，是用来炼制地品丹药的极好辅助材料，通常可以中和不同材料之间的冲突，增加炼制成功率。',
  //       details: {},
  //       quantity: 1,
  //     };

  //     const attachments = [
  //       {
  //         type: 'spirit_stones' as MailAttachmentType,
  //         name: '灵石',
  //         quantity: 100,
  //       },
  //       {
  //         type: 'material' as MailAttachmentType,
  //         name: '天火陨铁',
  //         quantity: 1,
  //         data: material1,
  //       },
  //       {
  //         type: 'material' as MailAttachmentType,
  //         name: '地心泉水',
  //         quantity: 1,
  //         data: material2,
  //       },
  //     ];

  //     await MailService.sendMail(cultivatorId, title, content, attachments);
  //   });
  // });

  it('给2026年创建的角色发放灵符奖励', async () => {
    const date = new Date('2026-01-01');
    const items = await db()
      .select()
      .from(cultivators)
      .where(or(gte(cultivators.createdAt, date), isNotNull(cultivators.title)))
      .execute();

    items.forEach(async (item) => {
      const title = '天道赐福：灵符降世';
      const content =
        '道友仙缘深厚，天道特赐下三枚灵符，助道友窥探天机，演化神通。';
      await MailService.sendMail(item.id, title, content, attachments);
    });
  });

  it('should send a mail with attachments to a specific cultivator', async () => {
    const cultivatorId = '0a545715-80ad-42d0-9f31-cf80c239a79c';
    const title = '天道赐福：灵符降世';
    const content =
      '道友仙缘深厚，天道特赐下三枚灵符，助道友窥探天机，演化神通。';

    await MailService.sendMail(cultivatorId, title, content, attachments);
  });
});
