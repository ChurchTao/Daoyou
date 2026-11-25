import type { MapAreaContent, MapPassage } from '@daoyou/game-domain/world/map';

const areaContent: Readonly<Record<string, MapAreaContent>> = {
  TN_MINE_VALLEY: {
    artwork: {
      file: 'mine-valley-v1.webp',
      alt: '矿棚和矿车道在河的一侧。木桥连接两岸，桥下石滩仍和村岸隔着水，药婆家和村口渡船都在村岸。',
      anchors: {
        'mine-shed': [0.23, 0.23],
        'wooden-bridge': [0.43, 0.4],
        'bridge-shoal': [0.45, 0.59],
        'herbalist-home': [0.76, 0.26],
        'village-ferry': [0.77, 0.73],
      },
    },
    places: [
      {
        id: 'mine-shed',
        name: '矿棚',
        description: '矿车道从矿棚外一路下坡，通往过河的木桥。',
        scene: {
          description: '过秤用的杆秤还搁在棚里。门外就是下山的矿车道。',
          npcs: [
            {
              id: 'mimi',
              name: '咪咪',
              portrait: 'icon:beast-mimi',
              storyOnly: true,
              action: '去棚门口找咪咪',
              reply: '棚门口堆着几个空筐。你下工时，咪咪常在筐旁等你。',
            },
          ],
          facilities: [
            {
              id: 'weighing-station',
              name: '记工台',
              purpose: '碎矿在这里过秤。',
              details: '杆秤旁摊着记工簿，簿上记着今天最后一筐矿。',
            },
          ],
        },
      },
      {
        id: 'wooden-bridge',
        name: '木桥',
        description: '矿车道尽头的木桥，平日从这里走到村岸。',
        scene: {
          description:
            '站在桥头，能看见村里晒网的竹竿。涨水时桥墩下只露出一小片石滩。',
          npcs: [],
          facilities: [
            {
              id: 'wooden-crossing',
              name: '过河桥面',
              purpose: '通往村岸',
              details: '从桥栏边往下看，能看见桥墩脚下的石滩。',
            },
          ],
        },
      },
      {
        id: 'bridge-shoal',
        name: '桥下石滩',
        description: '桥墩脚下露出一小片石滩，隔着急水望得见村岸。',
        scene: {
          description: '桥墩背水的一侧有道石缝。去村里的岸还隔着一段急流。',
          npcs: [
            {
              id: 'passing-disciple',
              name: '路过的宗门弟子',
              storyOnly: true,
              action: '请他带你过河',
              reply: '水还没退。站在墩脚背水的地方，当心别滑下去。',
            },
          ],
          facilities: [
            {
              id: 'sheltered-pier',
              name: '背水桥墩',
              purpose: '桥下可以落脚的地方',
              details: '桥墩背水处有一道石缝，河水漫不过来。',
            },
          ],
        },
      },
      {
        id: 'herbalist-home',
        name: '药婆家',
        description: '村岸的一户人家，窗下常晾着几筛草药。',
        scene: {
          description: '门口有药筛和小凳，窗下晾着刚拣过的草药。',
          npcs: [
            {
              id: 'herbalist',
              name: '药婆',
              action: '请药婆看看咪咪',
              reply: '小家伙若不肯给你碰，先让它坐稳了，别急着掰它的爪子。',
            },
          ],
        },
      },
      {
        id: 'village-ferry',
        name: '村口渡口',
        description: '阿禾的船泊在村口下游，一早顺流去山脚卸药。',
        scene: {
          description: '村岸的石径通到跳板边，船头放着一本记早渡乘客的客簿。',
          npcs: [
            {
              id: 'ahe',
              name: '阿禾',
              action: '向阿禾打听早渡',
              reply:
                '要搭早渡就在客簿上留个名字。等我点到你，抱稳东西再踩跳板。',
            },
          ],
          facilities: [
            {
              id: 'passenger-book',
              name: '早渡客簿',
              purpose: '留下乘船人的名字',
              details: '阿禾按簿子点人，早渡赶在下游药铺开门前靠岸。',
            },
          ],
        },
      },
    ],
  },
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
                '我还得顺流送货，今天不过河。沿这岸找，过了河弯有个换船的渡口。',
            },
          ],
          facilities: [
            {
              id: 'sect-array',
              name: '接引传送阵',
              purpose: '通往各家山门',
              details: '亭里的石阵由人照看。持路帖报出要去的山门，便可前往。',
            },
            {
              id: 'foothill-landing',
              name: '柳树渡埠',
              purpose: '沿岸船停靠处',
              details:
                '跳板搭在石阶边，沿岸的船在这儿上下客。',
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
            '木牌立在芦苇旁，石阶一直伸进水里。渡钟立在石阶上方。',
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
                '去白水镇的客船从这儿过河，候船可以坐石阶上。',
            },
            {
              id: 'reed-berth',
              name: '芦苇口旧泊位',
              purpose: '沿岸查看旧木桩',
              details: '从石阶沿着本岸往下游走，芦苇间斜露出几截旧桩。',
            },
          ],
        },
      },
      {
        id: 'baishui-town',
        name: '白水镇',
        description: '白水镇和药铺都在河对岸。平日从白水渡搭客船过河。',
        scene: {
          description: '泊船灯挂在石阶上方。上岸沿巷子走，便到药铺。',
          npcs: [
            {
              id: 'pharmacy-keeper',
              name: '药铺掌柜',
              action: '到药铺问问掌柜',
              reply: '要问什么药？进来说吧。',
            },
          ],
        },
      },
    ],
  },
};

export function getMapAreaContent(areaId: string): MapAreaContent | undefined {
  return Object.hasOwn(areaContent, areaId) ? areaContent[areaId] : undefined;
}

const passages: readonly MapPassage[] = [
  {
    id: 'village-ferry-to-foothill',
    from: { kind: 'area', areaId: 'TN_MINE_VALLEY', placeId: 'village-ferry' },
    to: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'foothill-pavilion' },
    label: '随早渡去接引亭',
    entrance: { name: '早渡木船', description: '沿河下行，停靠山脚接引亭。' },
  },
  {
    id: 'sect-gate-to-foothill',
    from: { kind: 'sect', spotId: 'gate' },
    to: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'foothill-pavilion' },
    label: '乘接引阵回山脚',
    entrance: { name: '山门接引阵', description: '穿过来时的石阵，回山脚接引亭。' },
  },
  {
    id: 'foothill-to-baishui',
    from: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'foothill-pavilion' },
    to: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'baishui-ferry' },
    label: '搭阿禾的船去白水渡',
    entrance: {
      name: '阿禾的船',
      description: '沿接引亭这面河岸顺流到白水渡。',
    },
  },
  {
    id: 'baishui-ferry-to-town',
    from: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'baishui-ferry' },
    to: { kind: 'area', areaId: 'TN_YUE_01', placeId: 'baishui-town' },
    label: '搭夜渡去白水镇',
    entrance: { name: '白水镇夜渡', description: '从石阶登船，横渡到白水镇。' },
  },
];

export function getMapPassage(id: string): MapPassage | undefined {
  return passages.find((passage) => passage.id === id);
}
