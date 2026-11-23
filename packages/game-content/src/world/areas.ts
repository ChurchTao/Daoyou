import type { MapAreaContent, MapPassage } from '@daoyou/game-domain/world/map';

const areaContent: Readonly<Record<string, MapAreaContent>> = {
  TN_YUE_01: {
    artwork: {
      file: 'taiyue-baishui-v1.webp',
      title: '白水水路',
      alt: '山脚接引亭、白水渡和白水镇一带的河道。',
      anchors: {
        'foothill-pavilion': [0.305, 0.24],
        'baishui-ferry': [0.46, 0.82],
        'baishui-town': [0.8, 0.46],
      },
    },
    places: [
      {
        id: 'foothill-pavilion',
        name: '山脚接引亭',
        description: '石亭下有一处渡埠。阿禾的船常靠在两棵柳树下。',
        scene: {
          description: '亭檐下挂着招徒的木牌。沿石阶下去，阿禾正在船上接空筐。',
          npcs: [
            {
              id: 'ahe',
              name: '阿禾',
              action: '向阿禾问去白水镇的路',
              reply:
                '我这条船贴着咱们这边走。你沿这面岸往下找，过了河弯有个渡埠，横过河的客船在那儿等。',
            },
          ],
          facilities: [
            {
              id: 'foothill-landing',
              name: '柳树渡埠',
              purpose: '沿岸船停靠处',
              details:
                '跳板搭在石阶边。阿禾的船正在接空筐，问过他就知道这一趟往哪儿走。',
            },
          ],
        },
      },
      {
        id: 'baishui-ferry',
        name: '白水渡',
        description: '过河弯后，和接引亭同岸的石阶渡埠。去对岸要在此换客渡。',
        scene: {
          description:
            '木牌立在芦苇旁，石阶一直伸进水里。横渡的客船还没有靠岸。',
          npcs: [
            {
              id: 'cake-vendor',
              name: '卖饼人',
              action: '打听横渡的客船',
              reply: '过河的人都在这几级石阶上等。船靠岸了，船工会喊一声。',
            },
          ],
          facilities: [
            {
              id: 'ferry-berth',
              name: '客渡泊位',
              purpose: '前往白水镇',
              details:
                '横渡的客船尚未靠岸。去白水镇的人可以在芦苇旁的石阶等船。',
            },
          ],
        },
      },
      {
        id: 'baishui-town',
        name: '白水镇',
        description: '镇子和药铺都在对岸。从白水渡改乘横渡的客船，才能到镇上。',
      },
    ],
  },
};

export function getMapAreaContent(areaId: string): MapAreaContent | undefined {
  return Object.hasOwn(areaContent, areaId) ? areaContent[areaId] : undefined;
}

const passages: readonly MapPassage[] = [
  {
    id: 'sect-gate-to-foothill',
    from: { kind: 'sect', spotId: 'gate' },
    to: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'foothill-pavilion' },
    label: '下山去接引亭',
  },
  {
    id: 'foothill-to-baishui',
    from: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'foothill-pavilion' },
    to: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'baishui-ferry' },
    label: '搭阿禾的船去白水渡',
  },
];

export function getMapPassage(id: string): MapPassage | undefined {
  return passages.find((passage) => passage.id === id);
}
