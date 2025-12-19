export interface ChangelogItem {
  version: string;
  date: string;
  title?: string;
  changes: string[];
  type: 'major' | 'minor' | 'patch';
}

export const changelogs: ChangelogItem[] = [
  {
    version: 'v0.5.1',
    date: '2025-12-19',
    title: '传音玉简上线',
    type: 'minor',
    changes: [
      '✨ 新增传音玉简功能，道友可随时查看天道消息。',
      '🎁 新增系统奖励，道友可领取。',
    ],
  },
  {
    version: 'v0.5.0',
    date: '2025-12-19',
    title: '万界道友初现',
    type: 'major',
    changes: [
      '✨ 新增版本日志功能，道友可随时查看天地异象更新。',
      '✨ 排行榜新增其他三种类型。',
      '🔧 优化了炼丹系统的炼制逻辑，平衡丹药属性和多材料炼制。',
      '🔧 优化了储物袋，丹药的 UI 展示，丹药可以显示持有数量。',
      '🐛 修复了若干已知的小问题。',
    ],
  },
  //   {
  //     version: 'v0.4.5',
  //     date: '2025-12-15',
  //     title: '炼丹功能上线',
  //     type: 'minor',
  //     changes: [
  //       '✨ 造物仙炉开启：新增炼丹功能，道友可炼制各式灵丹妙药。',
  //       '✨ 新增草药采集点，游历途中可偶遇珍稀灵植。',
  //       '💄 优化了炼丹炉的特效展示。',
  //     ],
  //   },
  //   {
  //     version: 'v0.4.0',
  //     date: '2025-12-01',
  //     title: '神通系统重构',
  //     type: 'minor',
  //     changes: [
  //       '⚡️ 重构了神通系统，技能释放更流畅。',
  //       '✨ 新增了3个新神通：火球术、冰锥术、掌心雷。',
  //       '📊 调整了部分神通的灵力消耗平衡。',
  //     ],
  //   },
];
