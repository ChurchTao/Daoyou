import type { SectDefinition } from '../../core/domain';

/** 组织身份与历史进度映射；战斗内容由 combat-v6 提供。 */
export const JIUJIE_DEFINITION: SectDefinition = {
  id: 'jiujie',
  name: '九劫天宫',
  description:
    '九劫天宫奉天听而执劫簿，以不可驱散的劫雷记录出手，以劫债等待天道清算。',
  raceIds: ['human'],
  configVersion: 1,
  methods: [
    {
      id: 'jiujie-canon',
      slot: 1,
      name: '《九劫天书》',
      isPrimary: true,
      description: '总录九劫法度，执雷而不滥刑。',
    },
    {
      id: 'calamity-eye',
      slot: 2,
      name: '《劫眼观世》',
      description: '以身为劫眼，观来力而承其灾。',
    },
    {
      id: 'heavenly-record',
      slot: 3,
      name: '《天谴录》',
      description: '以天听辨行为，以劫簿记主罪。',
    },
    {
      id: 'thunder-prison',
      slot: 4,
      name: '《雷狱镇魂》',
      description: '雷狱穿透护持，使天罚不为法障所蔽。',
    },
    {
      id: 'cause-judgment',
      slot: 5,
      name: '《因果问罪》',
      description: '问因果、收劫债，留足清算天威。',
    },
    {
      id: 'crossing-calamity',
      slot: 6,
      name: '《渡劫归真》',
      description: '渡劫之后仍守法身，不以天威伤己。',
    },
  ],
  abilities: [
    {
      id: 'thunder-finger',
      kind: 'default',
      baseName: '惊雷指',
      description: '仅在主动神通均不可用时使用，以雷力造成基础伤害。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'jiujie-canon',
        level: 1,
      },
    },
    {
      id: 'heaven-hearing',
      kind: 'active',
      baseName: '天听引雷',
      description: '造成0.55倍法攻雷伤，并在目标身上留下不可驱散的劫雷。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'jiujie-canon',
        level: 1,
      },
    },
    {
      id: 'receive-calamity',
      kind: 'active',
      baseName: '承天受劫',
      description: '暂承来力，将受过的灾厄记入劫簿。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'calamity-eye',
        level: 1,
      },
    },
    {
      id: 'calamity-seal',
      kind: 'active',
      baseName: '劫簿落印',
      description:
        '造成0.25倍法攻雷伤并落印；目标已有劫雷时，额外增加一层劫债。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'heavenly-record',
        level: 1,
      },
    },
    {
      id: 'thunder-prison-question',
      kind: 'active',
      baseName: '雷狱问行',
      description: '造成0.65倍法攻雷伤，追问目标仍在劫中的下一步并推进天罚。',
      role: 'combo',
      unlock: {
        type: 'method',
        methodId: 'thunder-prison',
        level: 1,
      },
    },
    {
      id: 'borrow-calamity',
      kind: 'active',
      baseName: '借劫回身',
      description: '消耗一分劫数，获得相当于最大气血15%的护盾。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'crossing-calamity',
        level: 1,
      },
    },
    {
      id: 'causal-echo',
      kind: 'active',
      baseName: '因果回响',
      description: '造成0.45倍法攻的基础雷伤，并根据劫债追加伤害。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'cause-judgment',
        level: 5,
      },
    },
    {
      id: 'nine-sky-settlement',
      kind: 'active',
      baseName: '九霄清算',
      description: '以劫数为引，清算目标累积的劫债。',
      role: 'finisher',
      unlock: {
        type: 'method',
        methodId: 'jiujie-canon',
        level: 10,
      },
    },
    {
      id: 'jiujie-tianwei-runtime',
      kind: 'passive',
      baseName: '天威裁决',
      description:
        '天宫弟子受到敌方主动法术或负面技能时，有20%的几率免疫整个技能。',
      role: 'defensive',
      unlock: {
        type: 'always',
      },
      sourceMethodId: 'heavenly-record',
    },
    {
      id: 'jiujie-law-runtime',
      kind: 'passive',
      baseName: '劫律运行',
      description: '记录劫雷触发与天宫劫簿。',
      role: 'utility',
      unlock: {
        type: 'always',
      },
      sourceMethodId: 'jiujie-canon',
      visibility: 'internal',
    },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'jiujie-canon': 5,
      'calamity-eye': 1,
      'heavenly-record': 1,
      'thunder-prison': 1,
      'cause-judgment': 1,
      'crossing-calamity': 1,
    },
    initialAbilityLoadout: ['heaven-hearing', 'calamity-seal', null, null],
  },
  paths: [
    {
      id: 'calamity-eye',
      name: '劫眼临身',
      description:
        '以身为劫眼，将敌人的来力、自己的伤势与天雷标记串成因果，再决定反击、护命或重开劫眼。',
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
      defaultTacticId: 'bear-and-return',
      tactics: [
        {
          id: 'bear-and-return',
          name: '承灾归劫',
          description: '先开启劫眼承受爆发，积满劫数后立即清算。',
        },
        {
          id: 'close-the-eye',
          name: '闭目守劫',
          description: '低血时借劫护身，其余时间保留劫数等待清算。',
        },
        {
          id: 'eye-of-thunder',
          name: '劫眼照身',
          description: '开启劫眼后优先落印，持续追问照见者。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '照见来者',
            description: '第一次攻击劫眼者会被照见，并受到后续神通追究。',
          },
          {
            name: '血甲同书',
            description: '承劫量可从伤势和护盾中积累，并转为伤害、治疗或护盾。',
          },
          {
            name: '劫后再开',
            description: '清算可以结束一劫，也可以立即开启下一轮承灾。',
          },
        ],
        abilityChanges: {
          'receive-calamity':
            '节点改变开眼方式、承劫来源、受击反应与劫眼续期。',
          'thunder-prison-question': '节点可追究照见目标并连接承劫循环。',
          'borrow-calamity': '节点可延续劫眼或在破盾后回生标雷。',
          'nine-sky-settlement':
            '节点决定承劫量转为真实伤害、治疗、护盾或下一轮劫眼。',
        },
      },
      nodes: [
        {
          id: 'eye-open',
          layerId: '1',
          name: '开门迎劫',
          description:
            '施展《承天受劫》时获得8%最大气血护盾；该护盾在承劫期间破裂时获得1点劫数，每次施法最多一次。',
        },
        {
          id: 'eye-bear',
          layerId: '1',
          name: '承灾留名',
          description:
            '劫眼第一次照见攻击者时额外反击0.15倍法攻雷伤；若其没有劫雷则施加劫雷，若已有劫雷则增加1层劫债。',
        },
        {
          id: 'eye-first-light',
          layerId: '1',
          name: '雷光护心',
          description:
            '每次劫眼存续期间第一次受到直接伤害后，获得5%最大气血护盾，并额外获得1点劫数。',
        },
        {
          id: 'eye-record',
          layerId: '2',
          name: '血甲同书',
          description:
            '承劫量可以记录护盾吸收的直接伤害；记录上限提高至自身最大气血的70%。',
        },
        {
          id: 'eye-question',
          layerId: '2',
          name: '问劫寻隙',
          description:
            '《雷狱问行》命中照见目标时，额外推进1层劫债，并使《承天受劫》当前冷却减少1回合。',
        },
        {
          id: 'eye-return',
          layerId: '2',
          name: '借劫续门',
          description:
            '《借劫回身》令当前劫眼和承天受劫各延长1回合；没有对应状态时不补开状态。',
        },
        {
          id: 'eye-guard',
          layerId: '3',
          name: '不退天门',
          description:
            '承天受劫期间，气血低于40%时首次受到直接伤害，消耗1点劫数使该次伤害额外降低20%；每回合最多一次。',
        },
        {
          id: 'eye-deep-return',
          layerId: '3',
          name: '劫威反震',
          description:
            '劫眼期间每回合第一次受到直接伤害后，对攻击者造成0.20倍法攻的雷属性反击伤害。',
        },
        {
          id: 'eye-still',
          layerId: '3',
          name: '静候雷来',
          description:
            '若一整个回合内劫眼没有记录到直接伤害，则回合结束时获得1点劫数，并使《承天受劫》冷却减少1回合。',
        },
        {
          id: 'eye-long-gaze',
          layerId: '4',
          name: '众劫归一',
          description:
            '《因果回响》命中照见目标时，额外释放当前承劫量的20%作为追击雷伤，但不消耗承劫量；每回合最多一次。',
        },
        {
          id: 'eye-heavy-thunder',
          layerId: '4',
          name: '雷狱追身',
          description:
            '《雷狱问行》命中照见目标时追加0.25倍法攻雷伤，并将劫眼刷新1回合。',
        },
        {
          id: 'eye-shelter',
          layerId: '4',
          name: '劫甲回生',
          description:
            '《借劫回身》的护盾破裂时，恢复6%最大气血，并为破盾者施加或刷新劫雷；每个护盾最多触发一次。',
        },
        {
          id: 'eye-true-record',
          layerId: '5',
          name: '真劫入簿',
          description: '《九霄清算》的承劫量以45%比例转为无属性真实伤害。',
        },
        {
          id: 'eye-returning-law',
          layerId: '5',
          name: '劫尽身还',
          description:
            '《九霄清算》除造成承劫伤害外，再将承劫量的25%转为自身治疗。',
        },
        {
          id: 'eye-after-rain',
          layerId: '5',
          name: '清算留门',
          description:
            '消耗3点劫数施展《九霄清算》后，重新获得1回合劫眼和基础承天受劫。',
        },
        {
          id: 'eye-nine-gates',
          layerId: 'ultimate',
          name: '九门归劫',
          description:
            '《九霄清算》以100%比例释放承劫量；若承劫量达到记录上限，额外推进目标1层劫债。',
        },
        {
          id: 'eye-heavenly-shield',
          layerId: 'ultimate',
          name: '身为天门',
          description:
            '《九霄清算》释放承劫伤害的同时，将承劫量的60%转为护盾，持续2回合。',
        },
        {
          id: 'eye-calamity-without-end',
          layerId: 'ultimate',
          name: '劫后再开',
          description:
            '《九霄清算》后获得2回合劫眼和1回合承天受劫；期间首次受击返还1点劫数，每3回合最多一次。',
        },
      ],
    },
    {
      id: 'heavenly-condemnation',
      name: '天谴加身',
      description:
        '观察目标如何行动，在重复主罪、改变罪名与退回普通攻击之间立案、追责并终审。',
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
      defaultTacticId: 'record-and-judge',
      tactics: [
        {
          id: 'record-and-judge',
          name: '记罪清算',
          description: '先施劫雷，再等待目标重复主罪后清算。',
        },
        {
          id: 'heavy-statute',
          name: '重典',
          description: '优先催审满债目标，再以终式兑现判词。',
        },
        {
          id: 'listen-to-heaven',
          name: '天听',
          description: '维持劫雷，积累劫数后执行终审。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '三类主罪',
            description: '伤罪、援罪与禁罪各自招致不同惩罚。',
          },
          {
            name: '变招有责',
            description: '重复、变罪和连续普通攻击都可被不同参悟追究。',
          },
          {
            name: '九霄判词',
            description: '终审可以速审、分类判罚，或清算后立即重新立案。',
          },
        ],
        abilityChanges: {
          'heaven-hearing':
            '劫雷期间每两次连续普通攻击给予1点劫数；节点可另行立案、延长劫雷或增加劫债。',
          'calamity-seal': '节点可锁定主罪、追究变罪并加速问行。',
          'thunder-prison-question': '节点可取得重犯证据或强制下一次行动候审。',
          'nine-sky-settlement': '节点决定速审成本、分类判词、留案与重新立案。',
        },
      },
      nodes: [
        {
          id: 'condemnation-record',
          layerId: '1',
          name: '天听记名',
          description:
            '《天听引雷》命中已有劫雷的目标时增加1层劫债；每个目标每回合最多一次。',
        },
        {
          id: 'condemnation-question',
          layerId: '1',
          name: '问行取证',
          description:
            '《雷狱问行》命中已有主罪的目标时增加1层重犯并追加0.15倍法攻雷伤，但不触发主罪的即时惩罚；每回合最多一次。',
        },
        {
          id: 'condemnation-first-crime',
          layerId: '1',
          name: '初罪立案',
          description:
            '目标每次新获得劫雷后，第一次使用非普通攻击的主动神通时，额外给予天宫弟子1点劫数。',
        },
        {
          id: 'condemnation-repeat',
          layerId: '2',
          name: '伤罪加刑',
          description: '目标重复伤罪时，其造成的直接伤害降低12%，持续1回合。',
        },
        {
          id: 'condemnation-heavy-debt',
          layerId: '2',
          name: '援罪断供',
          description:
            '目标重复援罪时，失去6%最大法力，并受到25%受治疗削弱，持续2回合。',
        },
        {
          id: 'condemnation-long-record',
          layerId: '2',
          name: '禁罪反照',
          description:
            '目标重复禁罪时，天宫弟子获得30%控制抗性1回合，目标速度降低10%两回合。',
        },
        {
          id: 'condemnation-no-pardon',
          layerId: '3',
          name: '易罪不赦',
          description:
            '目标在劫雷期间改变主罪类别时增加1层劫债，然后记录新主罪。',
        },
        {
          id: 'condemnation-debt-book',
          layerId: '3',
          name: '定罪成册',
          description:
            '《劫簿落印》命中已有主罪的目标时将该主罪定案；下一次其他类别神通不会替换主罪。',
        },
        {
          id: 'condemnation-heaven-hearing',
          layerId: '3',
          name: '庶行有录',
          description:
            '普通攻击仍不增加劫债和重犯，但会令劫雷延长1回合，并使本次基础雷罚提高30%。',
        },
        {
          id: 'condemnation-heavy-statute',
          layerId: '4',
          name: '重法催审',
          description:
            '《因果回响》命中3层劫债目标时，消耗1层劫债，获得1点劫数并追加0.30倍法攻雷伤。',
        },
        {
          id: 'condemnation-quick-record',
          layerId: '4',
          name: '疾书追罪',
          description:
            '《劫簿落印》命中已有主罪的目标后，《雷狱问行》冷却减少1回合；每回合最多一次。',
        },
        {
          id: 'condemnation-three-questions',
          layerId: '4',
          name: '三问成案',
          description:
            '《雷狱问行》命中至少2层劫债目标后施加候审；下一次非普通主动神通按重复主罪结算。',
        },
        {
          id: 'condemnation-reoffend',
          layerId: '5',
          name: '再犯从重',
          description: '《九霄清算》每层重犯的结算伤害额外计入50%强度的劫雷。',
        },
        {
          id: 'condemnation-clear-book',
          layerId: '5',
          name: '清册留案',
          description: '《九霄清算》消费劫债和重犯，但保留当前主罪与劫雷。',
        },
        {
          id: 'condemnation-no-escape',
          layerId: '5',
          name: '两避成罪',
          description:
            '同一目标在劫雷期间连续两次使用普通攻击时，第二次额外增加1层劫债。',
        },
        {
          id: 'condemnation-final-verdict',
          layerId: 'ultimate',
          name: '三债终审',
          description:
            '对3层劫债目标施展《九霄清算》时只消耗2点劫数，但按3点劫数计算基础清算伤害。',
        },
        {
          id: 'condemnation-nine-crimes',
          layerId: 'ultimate',
          name: '九罪同科',
          description: '《九霄清算》根据清算前的主罪追加伤罪、援罪或禁罪判词。',
        },
        {
          id: 'condemnation-heavenly-punishment',
          layerId: 'ultimate',
          name: '天谴不绝',
          description:
            '《九霄清算》后重新施加2回合劫雷和1层劫债，并重新开启立案。',
        },
      ],
    },
  ],
};
