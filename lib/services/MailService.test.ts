import { Material } from '@/types/cultivator';
import { db } from '../drizzle/db';
import { MailAttachmentType, MailService } from './MailService';

test('test 邮件发送', async () => {
  const cultivatorId = '786160f5-cdb2-4df6-a8fb-c2b63ead212c';
  const title = '系统测试邮件';
  const content = '这是一封测试邮件，包含20000灵石和几样材料。';
  await MailService.sendSystemMail(cultivatorId, title, content);
});

test('test 邮件发送', async () => {
  // 查询所有 title 不是null的角色
  const cultivators = await db.query.cultivators.findMany({
    where: (cultivators, { isNotNull }) => isNotNull(cultivators.title),
  });
  cultivators.forEach(async (cultivator) => {
    const cultivatorId = cultivator.id;
    const title = '系统测试邮件';
    const content = '这是一封测试邮件，包含20000灵石和几样材料。';
    const material1: Material = {
      name: '天火陨铁',
      rank: '天品',
      element: '火',
      type: 'ore',
      description:
        '天外飞来的神秘陨铁，蕴含着天火之力，可以炼制出更高级的材料。',
      details: {},
      quantity: 1,
    };
    const material2: Material = {
      name: '地心泉水',
      rank: '地品',
      element: '水',
      type: 'aux',
      description:
        '地心泉水，是用来炼制地品丹药的极好辅助材料，通常可以中和不同材料之间的冲突，增加炼制成功率。',
      details: {},
      quantity: 1,
    };

    const attachments = [
      {
        type: 'spirit_stones' as MailAttachmentType,
        name: '灵石',
        quantity: 100,
      },
      {
        type: 'material' as MailAttachmentType,
        name: '天火陨铁',
        quantity: 1,
        data: material1,
      },
      {
        type: 'material' as MailAttachmentType,
        name: '地心泉水',
        quantity: 1,
        data: material2,
      },
    ];

    await MailService.sendMail(cultivatorId, title, content, attachments);
  });
});
