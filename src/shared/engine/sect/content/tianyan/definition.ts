import type { SectDefinition } from '../../core/domain';

/** 组织身份与历史进度映射；战斗内容由 combat-v6 提供。 */
export const TIANYAN_DEFINITION: SectDefinition = {
  id: 'tianyan',
  name: '天衍圣地',
  description:
    '以五行法印推演前后术式的圣地。门人兼修金木水火土，却只能携四门主动神通入阵；胜负不在单法强弱，而在每一次留印之后如何落下下一子。',
  raceIds: ['human'],
  configVersion: 1,
  methods: [
    {
      id: 'tianyan-canon',
      slot: 1,
      name: '《天衍五行真经》',
      isPrimary: true,
      description:
        '以太初为纸，以五行为字。经中不求写尽天数，只教门人辨明一法之后仍有多少去处。',
    },
    {
      id: 'wood-vitality',
      slot: 2,
      name: '《青华生元录》',
      description:
        '草木荣枯并非两事；生机藏在未尽之处，也藏在愿意重新开始的一息里。',
    },
    {
      id: 'fire-illumination',
      slot: 3,
      name: '《离明流火章》',
      description:
        '火能照见，也能焚去。持火者先辨所燃为何，方知余烬应当归向何处。',
    },
    {
      id: 'earth-bearing',
      slot: 4,
      name: '《坤舆载物篇》',
      description:
        '地不与万物争先，却承受每一次落下的重量；能载其重，才能改其势。',
    },
    {
      id: 'metal-severing',
      slot: 5,
      name: '《太白裁虚诀》',
      description:
        '金气不只断形，也裁去遮蔽与虚妄。锋芒所至，应先知道何物不必留下。',
    },
    {
      id: 'water-flowing',
      slot: 6,
      name: '《玄冥行川法》',
      description: '水无常形，不与一岸相争。去路既改，仍能在曲折中守住归处。',
    },
  ],
  abilities: [
    {
      id: 'primordial-ray',
      kind: 'default',
      baseName: '太初玄光',
      description:
        '太初灵气无色无形，不入五行。指间玄光只问命中，不替之后的变化作答。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'tianyan-canon',
        level: 1,
      },
    },
    {
      id: 'verdant-pulse',
      kind: 'active',
      baseName: '青萝生脉',
      description: '青萝循气而生，一端缠住敌势，一端牵回施术者尚未断绝的生机。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'wood-vitality',
        level: 1,
      },
    },
    {
      id: 'myriad-wood-renewal',
      kind: 'active',
      baseName: '万木回春',
      description:
        '不催枯枝强生新叶，只把散落的生机逐寸引回，使该续的一息重新接上。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'wood-vitality',
        level: 5,
      },
    },
    {
      id: 'flowing-flame',
      kind: 'active',
      baseName: '离火流照',
      description:
        '离火不作一瞬暴烈，沿气机流照而过；光所及处，余焰仍在暗中寻找可燃之物。',
      role: 'combo',
      unlock: {
        type: 'method',
        methodId: 'fire-illumination',
        level: 1,
      },
    },
    {
      id: 'lotus-in-fire',
      kind: 'active',
      baseName: '火里种莲',
      description: '借一线心火焚去附骨之秽，又在余烬中留下一点不肯熄灭的明光。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'fire-illumination',
        level: 5,
      },
    },
    {
      id: 'earth-bearing-seal',
      kind: 'active',
      baseName: '坤岳镇形',
      description:
        '坤气落下，不急于压碎敌形，先在施术者身前立住一座可承来力的山岳。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'earth-bearing',
        level: 1,
      },
    },
    {
      id: 'boundless-earth',
      kind: 'active',
      baseName: '地载无疆',
      description:
        '地不拒轻重，也不问来处。法域展开之时，落在其中的每一道力量都先由厚土承接。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'earth-bearing',
        level: 5,
      },
    },
    {
      id: 'metal-cloud-cutter',
      kind: 'active',
      baseName: '庚金裁云',
      description: '庚金凝成一线，所裁并非云气，而是藏在云后的护持与虚势。',
      role: 'finisher',
      unlock: {
        type: 'method',
        methodId: 'metal-severing',
        level: 1,
      },
    },
    {
      id: 'white-star-breaker',
      kind: 'active',
      baseName: '太白破阵',
      description:
        '太白一线照入阵眼，先去遮蔽，再断灵机；锋芒不求伤重，只求所见再无虚假。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'metal-severing',
        level: 5,
      },
    },
    {
      id: 'dark-water-return',
      kind: 'active',
      baseName: '玄水回澜',
      description:
        '玄水不与来势正争，只在回澜时带走立足之力，使快者迟、满者退。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'water-flowing',
        level: 1,
      },
    },
    {
      id: 'heavenly-river-cleansing',
      kind: 'active',
      baseName: '天河洗心',
      description:
        '引天河过心窍，不洗记忆，也不洗选择，只带走此刻不应继续停留的浊意。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'water-flowing',
        level: 5,
      },
    },
    {
      id: 'shift-palace',
      kind: 'active',
      baseName: '移宫换宿',
      description:
        '星宿未移，观测之宫先改。法印沿相生次序转过一位，原本无路的下一法便有了新的去处。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'tianyan-canon',
        level: 5,
      },
    },
    {
      id: 'five-qi-repository',
      kind: 'active',
      baseName: '五气归藏',
      description:
        '推演不必每次走到尽头。将尚未用尽的法印收回太初，余势仍可归为护身、养气与下一法的凭依。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'tianyan-canon',
        level: 10,
      },
    },
    {
      id: 'tianyan-runtime',
      kind: 'passive',
      baseName: '太初衍脉',
      description:
        '太初灵气本无定色。天衍神通不受异灵根失配影响；与本命灵根相同的法术仍可获得灵根共鸣。',
      role: 'combo',
      unlock: {
        type: 'always',
      },
      visibility: 'internal',
    },
    {
      id: 'hetu-runtime',
      kind: 'passive',
      baseName: '河图周天',
      description: '三数成图，令伤势、气血与法力在同一轮转中续接。',
      role: 'combo',
      unlock: {
        type: 'active_path',
        pathId: 'hetu-evolution',
      },
      visibility: 'internal',
    },
    {
      id: 'luoshu-runtime',
      kind: 'passive',
      baseName: '洛书断局',
      description: '三数定局，在敌势成形之前追加一次无属性断击。',
      role: 'finisher',
      unlock: {
        type: 'active_path',
        pathId: 'luoshu-control',
      },
      visibility: 'internal',
    },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'tianyan-canon': 5,
      'wood-vitality': 1,
      'fire-illumination': 1,
      'earth-bearing': 1,
      'metal-severing': 1,
      'water-flowing': 1,
    },
    initialAbilityLoadout: [
      'verdant-pulse',
      'flowing-flame',
      'dark-water-return',
      'shift-palace',
    ],
  },
  paths: [
    {
      id: 'hetu-evolution',
      name: '河图演生',
      description:
        '河图示其流，前法不灭，后法由此而生。三数成图之后，伤势、气血与法力都在同一轮转中得到续接。',
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
      defaultTacticId: 'small-cycle',
      tactics: [
        {
          id: 'small-cycle',
          name: '小周天',
          description: '优先选择能够继续反应的落印术，以三行闭环维持周天。',
        },
        {
          id: 'nourish-origin',
          name: '养元',
          description: '血线或法力不足时优先内景法，其余时间维持反应。',
        },
        {
          id: 'unbroken-flow',
          name: '不绝',
          description: '有印而无可用反应时优先移宫，否则以太初玄光保留法印。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '三数成图',
            description: '每三次反应形成一次小周天，同时补充输出与资源。',
          },
          {
            name: '内外相养',
            description: '治疗、壁垒和秘法能够进入反应构筑。',
          },
          {
            name: '留白不断',
            description: '太初玄光可以等待时机而不破坏法印。',
          },
        ],
        abilityChanges: {
          'tianyan-runtime':
            '第三次反应触发河图周天，强化主伤害并回复气血与法力。',
        },
      },
      nodes: [
        {
          id: 'hetu-first-number',
          layerId: '1',
          name: '初数有应',
          description: '战斗开始时获得1点衍数。',
        },
        {
          id: 'hetu-lasting-seal',
          layerId: '1',
          name: '印留三刻',
          description: '落印术施加的新法印基础持续时间提高至3回合。',
        },
        {
          id: 'hetu-blank-breath',
          layerId: '1',
          name: '太初留白',
          description: '每回合首次以太初玄光命中带印目标时，回复3%最大法力。',
        },
        {
          id: 'hetu-flow-refund',
          layerId: '2',
          name: '法随气转',
          description: '成功触发反应后，返还本次落印术实际支付的20点法力。',
        },
        {
          id: 'hetu-shift-carries',
          layerId: '2',
          name: '移宫承流',
          description: '移宫换宿成功转化法印时获得1点衍数。',
        },
        {
          id: 'hetu-repository-remnant',
          layerId: '2',
          name: '归藏纳余',
          description: '五气归藏数值收益提高20%，并获得1点衍数。',
        },
        {
          id: 'hetu-verdant-endless',
          layerId: '3',
          name: '青华不竭',
          description: '木行治疗提高25%；首次令目标满血时获得护盾。',
        },
        {
          id: 'hetu-fire-earth-shelter',
          layerId: '3',
          name: '火土相庇',
          description: '降低火里种莲成本并强化地载无疆。',
        },
        {
          id: 'hetu-river-cleansing',
          layerId: '3',
          name: '天河洗尘',
          description:
            '天河洗心净化3个状态，回复12%最大法力并提高30%控制抗性。',
        },
        {
          id: 'hetu-generation-gate',
          layerId: '4',
          name: '生门并开',
          description: '每次触发化生后回复2%最大气血。',
        },
        {
          id: 'hetu-overcoming-harmony',
          layerId: '4',
          name: '克中留和',
          description: '每次触发冲克后获得3%最大气血护盾。',
        },
        {
          id: 'hetu-three-talents',
          layerId: '4',
          name: '三才合契',
          description: '以三种不同新元素触发反应时，第三术主伤害提高20%。',
        },
        {
          id: 'hetu-scroll-open',
          layerId: '5',
          name: '河图开卷',
          description: '河图周天主伤害增幅提高至35%。',
        },
        {
          id: 'hetu-number-remains',
          layerId: '5',
          name: '余数不尽',
          description: '河图周天结算后保留1点衍数。',
        },
        {
          id: 'hetu-inner-outer',
          layerId: '5',
          name: '内外相养',
          description: '施展内景法后，下一次反应额外获得1点衍数。',
        },
        {
          id: 'hetu-one-line-opens',
          layerId: 'ultimate',
          name: '一画开天',
          description: '强化河图周天主伤害与非控制反应数值。',
        },
        {
          id: 'hetu-endless-life',
          layerId: 'ultimate',
          name: '生生无穷',
          description: '河图周天额外回复气血与法力，并保留1点衍数。',
        },
        {
          id: 'hetu-escaped-one-returns',
          layerId: 'ultimate',
          name: '遁一归元',
          description:
            '每装备1门非落印主动神通，宗门直接伤害、治疗与护盾提高8%，最多2门。',
        },
      ],
    },
    {
      id: 'luoshu-control',
      name: '洛书制化',
      description:
        '洛书定其位，不等万法自然流转。移一宫、断一势、藏一印，在敌势真正成形之前先改写它的去处。',
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
      defaultTacticId: 'break-pattern',
      tactics: [
        {
          id: 'break-pattern',
          name: '破阵',
          description: '优先触发冲克并利用太白破阵驱散敌方增益。',
        },
        {
          id: 'lock-meridian',
          name: '锁机',
          description: '优先准备并触发断脉或泥沼，压缩敌方行动。',
        },
        {
          id: 'decisive-derivation',
          name: '断局',
          description: '优先预期直接伤害最高的反应，必要时移宫或归藏。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '移宫改局',
            description: '主动转换法印，准备关键冲克。',
          },
          {
            name: '制化断势',
            description: '破防、禁法、定身与削攻共同压缩敌方选择。',
          },
          {
            name: '三数决胜',
            description: '每三次反应获得一次稳定的无属性爆发。',
          },
        ],
        abilityChanges: {
          'tianyan-runtime':
            '第三次反应触发洛书断局，追加无属性伤害并强化属性削弱。',
        },
      },
      nodes: [
        {
          id: 'luoshu-first-number',
          layerId: '1',
          name: '一数先立',
          description: '战斗开始时获得1点衍数。',
        },
        {
          id: 'luoshu-observe-gap',
          layerId: '1',
          name: '观印知隙',
          description: '宗门直接伤害对带有天衍法印的目标提高8%。',
        },
        {
          id: 'luoshu-first-change',
          layerId: '1',
          name: '第一变',
          description:
            '每场战斗首次落印命中无印目标后返还80点实付法力，并使新印持续3回合。',
        },
        {
          id: 'luoshu-fast-shift',
          layerId: '2',
          name: '移宫疾算',
          description: '移宫换宿消耗降至80，冷却降至1回合。',
        },
        {
          id: 'luoshu-reverse-two',
          layerId: '2',
          name: '倒演两宫',
          description: '移宫换宿改为移动两位；下一次反应主伤害提高20%。',
        },
        {
          id: 'luoshu-hidden-counter',
          layerId: '2',
          name: '藏印为筹',
          description: '五气归藏数值收益提高25%，并获得1点衍数。',
        },
        {
          id: 'luoshu-flame-flow',
          layerId: '3',
          name: '炎流相激',
          description: '强化燎原、蒸发与熔金。',
        },
        {
          id: 'luoshu-mountain-wood',
          layerId: '3',
          name: '山木倾覆',
          description: '强化熔岩、泥沼与崩根。',
        },
        {
          id: 'luoshu-metal-water',
          layerId: '3',
          name: '金水决机',
          description: '强化锻锋、寒泉与断脉。',
        },
        {
          id: 'luoshu-lock-position',
          layerId: '4',
          name: '定势锁机',
          description: '提高泥沼与断脉控制命中，并强化抵抗后的替代削弱。',
        },
        {
          id: 'luoshu-exploit-weakness',
          layerId: '4',
          name: '乘虚而入',
          description: '目标拥有普通减益或控制时，宗门直接伤害提高15%。',
        },
        {
          id: 'luoshu-dispel-truth',
          layerId: '4',
          name: '斩护见真',
          description: '每3回合首次触发冲克时，在主伤害前驱散1个普通增益。',
        },
        {
          id: 'luoshu-chain-control',
          layerId: '5',
          name: '连环制化',
          description: '连续反应令后续落印术主伤害提高8%，最多3层。',
        },
        {
          id: 'luoshu-shatter-seal',
          layerId: '5',
          name: '碎印夺机',
          description:
            '目标低于40%气血时粉碎新印，并追加主伤害45%的无属性伤害。',
        },
        {
          id: 'luoshu-save-error',
          layerId: '5',
          name: '失算犹存',
          description: '每回合首次无反应覆盖时保留旧印。',
        },
        {
          id: 'luoshu-nine-changes',
          layerId: 'ultimate',
          name: '洛书九变',
          description: '洛书断局追伤提高至100%，非控制削弱增幅提高至35%。',
        },
        {
          id: 'luoshu-guest-becomes-host',
          layerId: 'ultimate',
          name: '反客为主',
          description: '洛书断局后保留1点衍数，并使本次新印持续3回合。',
        },
        {
          id: 'luoshu-heaven-ends',
          layerId: 'ultimate',
          name: '天机尽处',
          description:
            '目标低于35%气血时，冲克主伤害获得按已损气血缩放的法攻系数。',
        },
      ],
    },
  ],
};
