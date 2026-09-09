import type { SectDefinition } from '../../core/domain';

/** 组织身份与历史进度映射；战斗内容由 combat-v6 提供。 */
export const YOUDU_DEFINITION: SectDefinition = {
  id: 'youdu',
  name: '幽都',
  description:
    '幽都门人通晓三魂七魄，以术伤侵形、魂伤越防，并用蚀魂逐层削弱敌人的气血上限、攻防与治疗。其术起势缓慢，却最擅长让强敌在不知不觉间失去还手之力。',
  raceIds: ['human'],
  configVersion: 1,
  methods: [
    {
      id: 'youdu-canon',
      slot: 1,
      name: '《幽都魂典》',
      isPrimary: true,
      description: '录三魂往复、七魄离合之理，是幽都诸法的总纲。',
    },
    {
      id: 'three-souls-separation',
      slot: 2,
      name: '《三魂离合篇》',
      description: '辨胎光、爽灵、幽精的去留，从影迹中寻出魂魄缝隙。',
    },
    {
      id: 'forgetful-river-record',
      slot: 3,
      name: '《忘川渡夜录》',
      description: '记黑水涨落与游魂归路，令潮声在形神之间长久回荡。',
    },
    {
      id: 'seven-souls-seizure',
      slot: 4,
      name: '《七魄夺形法》',
      description: '七魄各守形骸一处，去其一，身中灯火便暗一盏。',
    },
    {
      id: 'soul-pinning-ironbook',
      slot: 5,
      name: '《镇魂铁册》',
      description: '以幽都旧铁定影镇魂，使离散之魂不得妄动。',
    },
    {
      id: 'dead-heart-living-spirit',
      slot: 6,
      name: '《心死神活诀》',
      description: '心念寂处，神魂反得清明，不为外法轻易拘束。',
    },
  ],
  abilities: [
    {
      id: 'one-sigh',
      kind: 'default',
      baseName: '一叹',
      description: '叹气若游丝，魂已松三分。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'youdu-canon',
        level: 1,
      },
    },
    {
      id: 'soul-severing-call',
      kind: 'active',
      baseName: '离魂引',
      description: '循一声呼唤牵动游魂，魂愈远，越容易被引出形骸。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'three-souls-separation',
        level: 1,
      },
    },
    {
      id: 'reveal-shadow',
      kind: 'active',
      baseName: '照影',
      description: '影者，魂之迹也；见影如见魂。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'three-souls-separation',
        level: 5,
      },
    },
    {
      id: 'forgetful-river-tide',
      kind: 'active',
      baseName: '忘川潮',
      description: '黑水无舟，闻潮者各自忘归。',
      role: 'combo',
      unlock: {
        type: 'method',
        methodId: 'forgetful-river-record',
        level: 3,
      },
    },
    {
      id: 'seize-soul',
      kind: 'active',
      baseName: '夺魄',
      description: '七魄去其一，如灯灭一盏。',
      role: 'combo',
      unlock: {
        type: 'method',
        methodId: 'seven-souls-seizure',
        level: 3,
      },
    },
    {
      id: 'pin-soul',
      kind: 'active',
      baseName: '镇魂',
      description: '以幽都之铁钉住影迹，镇汝魂魄，不得妄动。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'soul-pinning-ironbook',
        level: 5,
      },
    },
    {
      id: 'soul-shall-not-return',
      kind: 'active',
      baseName: '魂兮不归',
      description: '归来的呼声止于黑水，此后魂行千里，再无归路。',
      role: 'finisher',
      unlock: {
        type: 'method',
        methodId: 'youdu-canon',
        level: 10,
      },
    },
    {
      id: 'youdu-runtime',
      kind: 'passive',
      baseName: '心死神活',
      description: '常驻控制韧性，并在每场第一次受控后自行解脱。',
      role: 'defensive',
      unlock: {
        type: 'always',
      },
      sourceMethodId: 'dead-heart-living-spirit',
      visibility: 'internal',
    },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'youdu-canon': 5,
      'three-souls-separation': 1,
      'forgetful-river-record': 1,
      'seven-souls-seizure': 1,
      'soul-pinning-ironbook': 1,
      'dead-heart-living-spirit': 1,
    },
    initialAbilityLoadout: ['soul-severing-call', null, null, null],
  },
  paths: [
    {
      id: 'tide',
      name: '招魂渡夜',
      description:
        '一声唤名落入黑水，千里游魂都听见自己的回音。此道让忘川一寸寸漫过归路。',
      minRealm: '筑基',
      minRealmStage: '中期',
      layers: [
        {
          id: '1',
          order: 1,
          label: '第一层',
          minRealm: '筑基',
          minRealmStage: '中期',
          cost: {
            cultivationExp: 5000,
            comprehensionInsight: 100,
            spiritStones: 25000,
          },
        },
        {
          id: '2',
          order: 2,
          label: '第二层',
          minRealm: '金丹',
          minRealmStage: '圆满',
          cost: {
            cultivationExp: 20000,
            comprehensionInsight: 100,
            spiritStones: 100000,
          },
        },
        {
          id: '3',
          order: 3,
          label: '第三层',
          minRealm: '化神',
          minRealmStage: '中期',
          cost: {
            cultivationExp: 80000,
            comprehensionInsight: 100,
            spiritStones: 400000,
          },
        },
        {
          id: '4',
          order: 4,
          label: '第四层',
          minRealm: '炼虚',
          minRealmStage: '圆满',
          cost: {
            cultivationExp: 320000,
            comprehensionInsight: 100,
            spiritStones: 1600000,
          },
        },
        {
          id: '5',
          order: 5,
          label: '第五层',
          minRealm: '大乘',
          minRealmStage: '中期',
          cost: {
            cultivationExp: 1280000,
            comprehensionInsight: 100,
            spiritStones: 6400000,
          },
        },
        {
          id: 'ultimate',
          order: 6,
          label: '终式',
          minRealm: '渡劫',
          minRealmStage: '圆满',
          cost: {
            cultivationExp: 5120000,
            comprehensionInsight: 100,
            spiritStones: 25600000,
          },
        },
      ],
      defaultTacticId: 'tide-cycle',
      tactics: [
        {
          id: 'tide-cycle',
          name: '回潮',
          description: '优先补忘川并维持三层蚀魂，在终结线兑现。',
        },
        {
          id: 'healer-drown',
          name: '沉医',
          description: '维持忘川压疗，在高层窗口优先镇魂。',
        },
        {
          id: 'long-night',
          name: '长夜',
          description: '延后终结，维持四层压力，魂火满或低血时再兑现。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '长夜回潮',
            description: '忘川对深度蚀魂目标造成更多魂伤。',
          },
          {
            name: '药石难入',
            description: '以忘川与蚀魂叠加压缩治疗窗口。',
          },
          {
            name: '余烬不散',
            description: '终结之后仍可保留下一轮铺垫。',
          },
        ],
        abilityChanges: {
          'forgetful-river-tide':
            '忘川在至少3层蚀魂目标上提高20%持续魂伤，并能从每回合首次有效潮伤中获得魂火。',
          'soul-shall-not-return':
            '节点可强化逐层魂伤、保留蚀魂、留存魂火或在终结后续接忘川。',
        },
      },
      nodes: [
        {
          id: 'tide-first-ripple',
          layerId: '1',
          name: '一水忘川',
          description: '忘川的直接魂伤与每次持续魂伤提高15%。',
        },
        {
          id: 'tide-call-the-name',
          layerId: '1',
          name: '唤名成痕',
          description:
            '一叹命中带有忘川的目标时，术伤提高20%并额外获得1点魂火，每回合最多一次。',
        },
        {
          id: 'tide-soul-lantern',
          layerId: '1',
          name: '魂灯初照',
          description: '战斗开始时获得1点魂火。',
        },
        {
          id: 'tide-never-ebbs',
          layerId: '2',
          name: '潮声不歇',
          description: '忘川持续时间由2回合提高到3回合。',
        },
        {
          id: 'tide-no-medicine',
          layerId: '2',
          name: '彼岸无医',
          description: '忘川的受治疗削弱由20%提高到30%。',
        },
        {
          id: 'tide-black-water',
          layerId: '2',
          name: '黑水浸魄',
          description: '带有忘川的目标速度额外降低8%。',
        },
        {
          id: 'tide-three-souls-far',
          layerId: '3',
          name: '三魂皆远',
          description: '蚀魂3层与4层的气血上限与攻防削弱提高到10%与15%。',
        },
        {
          id: 'tide-herbs-fail',
          layerId: '3',
          name: '药石难入',
          description: '蚀魂3层与4层的受治疗削弱提高到40%与60%。',
        },
        {
          id: 'tide-crossing-echo',
          layerId: '3',
          name: '渡口回声',
          description:
            '每回合第一次对至少4层目标结算忘川时，追加0.12倍法攻魂伤。',
        },
        {
          id: 'tide-no-return-current',
          layerId: '4',
          name: '江流不返',
          description: '忘川对至少4层目标造成的持续魂伤总计提高45%。',
        },
        {
          id: 'tide-cleanse-toll',
          layerId: '4',
          name: '洗魂有价',
          description:
            '敌人驱散蚀魂层数后受到0.12倍法攻魂伤，自身获得1点魂火，每次行动最多一次。',
        },
        {
          id: 'tide-shoreless',
          layerId: '4',
          name: '两岸俱失',
          description:
            '不归的速度降低由30%提高到40%；魂兮不归命中后额外获得1点魂火。',
        },
        {
          id: 'tide-hundred-ghosts',
          layerId: '5',
          name: '百鬼同哭',
          description:
            '目标每次进入5层时追加0.30倍法攻魂伤，同一目标每3回合最多一次。',
        },
        {
          id: 'tide-dream-invasion',
          layerId: '5',
          name: '魂梦相侵',
          description:
            '目标进入5层时刷新忘川，并立即额外结算一次基础忘川魂伤。',
        },
        {
          id: 'tide-last-ferry',
          layerId: '5',
          name: '末渡无舟',
          description: '带有忘川的目标进入5层时，额外失去10%最大法力。',
        },
        {
          id: 'tide-embers-remain',
          layerId: 'ultimate',
          name: '不归亦不散',
          description: '魂兮不归结算后保留2层蚀魂。',
        },
        {
          id: 'tide-lament-deepens',
          layerId: 'ultimate',
          name: '楚些成悲',
          description: '魂兮不归每层追加魂伤由0.20提高到0.24。',
        },
        {
          id: 'tide-burial-current',
          layerId: 'ultimate',
          name: '黑潮送行',
          description: '魂兮不归结算后给目标施加2回合忘川。',
        },
      ],
    },
    {
      id: 'decree',
      name: '镇魄司命',
      description:
        '见影而知魂，知魂而书名；铁钉落下之前，门人已量过每一道离身缝隙。',
      minRealm: '筑基',
      minRealmStage: '中期',
      layers: [
        {
          id: '1',
          order: 1,
          label: '第一层',
          minRealm: '筑基',
          minRealmStage: '中期',
          cost: {
            cultivationExp: 5000,
            comprehensionInsight: 100,
            spiritStones: 25000,
          },
        },
        {
          id: '2',
          order: 2,
          label: '第二层',
          minRealm: '金丹',
          minRealmStage: '圆满',
          cost: {
            cultivationExp: 20000,
            comprehensionInsight: 100,
            spiritStones: 100000,
          },
        },
        {
          id: '3',
          order: 3,
          label: '第三层',
          minRealm: '化神',
          minRealmStage: '中期',
          cost: {
            cultivationExp: 80000,
            comprehensionInsight: 100,
            spiritStones: 400000,
          },
        },
        {
          id: '4',
          order: 4,
          label: '第四层',
          minRealm: '炼虚',
          minRealmStage: '圆满',
          cost: {
            cultivationExp: 320000,
            comprehensionInsight: 100,
            spiritStones: 1600000,
          },
        },
        {
          id: '5',
          order: 5,
          label: '第五层',
          minRealm: '大乘',
          minRealmStage: '中期',
          cost: {
            cultivationExp: 1280000,
            comprehensionInsight: 100,
            spiritStones: 6400000,
          },
        },
        {
          id: 'ultimate',
          order: 6,
          label: '终式',
          minRealm: '渡劫',
          minRealmStage: '圆满',
          cost: {
            cultivationExp: 5120000,
            comprehensionInsight: 100,
            spiritStones: 25600000,
          },
        },
      ],
      defaultTacticId: 'pin-the-caster',
      tactics: [
        {
          id: 'pin-the-caster',
          name: '钉法者',
          description: '优先照影并压制敌方术者，在关键窗口镇魂。',
        },
        {
          id: 'judge-at-four',
          name: '四层判决',
          description:
            '集中单一目标，达到终结要求立即裁决；司命判词可提前到三层。',
        },
        {
          id: 'take-the-fifth',
          name: '取其第五',
          description: '优先触发失魂，再在归窍窗口储存魂火。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '司命断章',
            description: '直接魂伤在高层目标上更强。',
          },
          {
            name: '见影知名',
            description: '照影将层数进一步化为自身魂伤。',
          },
          {
            name: '镇魄裁断',
            description: '在四层抉择控制、失魂或终结。',
          },
        ],
        abilityChanges: {
          'reveal-shadow':
            '成功施加照影时获得1点魂火；自身对照影目标造成魂伤时，每层蚀魂额外提高1%。',
          'pin-soul': '节点可强化高层镇魂的命中、速度压制与法力效率。',
          'soul-shall-not-return':
            '节点可强化逐层魂伤、把最低终结层数提前到3层，并提供裁决后的资源回转。',
        },
      },
      nodes: [
        {
          id: 'decree-iron-enters-shadow',
          layerId: '1',
          name: '铁入其影',
          description: '夺魄与镇魂的术伤、魂伤各提高20%。',
        },
        {
          id: 'decree-see-true-name',
          layerId: '1',
          name: '见影知名',
          description: '照影持续时间提高到4回合。',
        },
        {
          id: 'decree-guard-the-spirit',
          layerId: '1',
          name: '守神如城',
          description: '控制抗性额外提高10个百分点。',
        },
        {
          id: 'decree-first-soul-taken',
          layerId: '2',
          name: '一魄先夺',
          description: '夺魄的降攻提高到25%，持续时间提高到3回合。',
        },
        {
          id: 'decree-silent-nail',
          layerId: '2',
          name: '钉下无声',
          description: '镇魂法力消耗降低40点。',
        },
        {
          id: 'decree-bright-prison-fire',
          layerId: '2',
          name: '狱火照名',
          description: '三点魂火的直接魂伤增幅由25%提高到35%。',
        },
        {
          id: 'decree-three-souls-leave',
          layerId: '3',
          name: '三魂离座',
          description: '离魂引对至少3层目标的增伤由50%提高到70%。',
        },
        {
          id: 'decree-fix-form-first',
          layerId: '3',
          name: '先定其形',
          description: '每场首次命中照影目标的幽都铺层神通额外增加1层蚀魂。',
        },
        {
          id: 'decree-dead-heart-counter',
          layerId: '3',
          name: '心寂反照',
          description:
            '心死神活首次解控时获得2点魂火；每回合首次成功抵抗控制也获得2点。',
        },
        {
          id: 'decree-four-gates-closed',
          layerId: '4',
          name: '四门皆闭',
          description:
            '镇魂命中施法前至少4层目标时，追加0.20倍法攻魂伤，并令其速度降低20%两回合。',
        },
        {
          id: 'decree-punishment-measured',
          layerId: '4',
          name: '魂刑有度',
          description:
            '失魂被抵抗或控制免疫阻止时，目标攻击与速度仍降低20%两回合。',
        },
        {
          id: 'decree-iron-law',
          layerId: '4',
          name: '幽都铁律',
          description: '对至少4层蚀魂目标施加控制时，控制命中提高15个百分点。',
        },
        {
          id: 'decree-five-souls-scattered',
          layerId: '5',
          name: '五魄俱散',
          description: '目标从失魂回落后，攻击额外降低15%两回合。',
        },
        {
          id: 'decree-returning-barrier',
          layerId: '5',
          name: '神归有垣',
          description: '心死神活首次解控后，获得15%最大气血护盾。',
        },
        {
          id: 'decree-one-name-one-judgment',
          layerId: '5',
          name: '一名一判',
          description: '目标首次进入4层后获得标记；下一次终结命中返还60法力。',
        },
        {
          id: 'decree-verdict',
          layerId: 'ultimate',
          name: '司命判词',
          description:
            '魂兮不归基础魂伤由0.70提高到0.85，并可对3层蚀魂目标施放。',
        },
        {
          id: 'decree-seven-inch-severance',
          layerId: 'ultimate',
          name: '七寸断魂',
          description: '魂兮不归每层追加魂伤由0.20提高到0.25。',
        },
        {
          id: 'decree-name-in-youdu',
          layerId: 'ultimate',
          name: '名落幽都',
          description:
            '终结后目标低于35%气血时获得3魂火并返还2回合冷却，每场一次。',
        },
      ],
    },
  ],
};
