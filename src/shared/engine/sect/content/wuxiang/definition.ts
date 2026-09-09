import type { SectDefinition } from '../../core/domain';

/** 组织身份与历史进度映射；战斗内容由 combat-v6 提供。 */
export const WUXIANG_DEFINITION: SectDefinition = {
  id: 'wuxiang',
  name: '无相禅宗',
  description:
    '此宗不避魔心，不弃色身。门人以皮囊为道场，以气血燃业火；佛法用来照见诸苦，魔功用来横渡诸苦。',
  raceIds: ['human'],
  configVersion: 2,
  methods: [
    {
      id: 'wuxiang-canon',
      slot: 1,
      name: '《无相真解》',
      isPrimary: true,
      description: '观色身诸相皆无定相，于一念之间容佛、容魔，亦容无相。',
    },
    {
      id: 'blood-lotus',
      slot: 2,
      name: '《血海生莲》',
      description: '血海不净，莲亦由此而生；知其污浊，方能借之渡身。',
    },
    {
      id: 'white-bone',
      slot: 3,
      name: '《白骨照身》',
      description: '去皮肉浮相，见白骨本真；以朽坏之身承受来力。',
    },
    {
      id: 'wrathful-ming',
      slot: 4,
      name: '《明王降魔》',
      description: '明王怒目，不为嗔心，只借烈相斩断迟疑。',
    },
    {
      id: 'six-senses',
      slot: 5,
      name: '《六根守识》',
      description: '声色香味触法皆至于前，心识自守，不随外境转移。',
    },
    {
      id: 'reed-crossing-method',
      slot: 6,
      name: '《一苇渡苦》',
      description: '苦海无边，轻身不待舟楫；一苇所向，只问彼岸。',
    },
  ],
  abilities: [
    {
      id: 'flower-heart',
      kind: 'default',
      baseName: '拈花叩心',
      description:
        '指间拈花，叩问的却是敌我同一颗心。佛相立其因，魔相照其果，无相令因果同现。',
      role: 'generator',
      unlock: {
        type: 'method',
        methodId: 'wuxiang-canon',
        level: 1,
      },
    },
    {
      id: 'blood-tide',
      kind: 'active',
      baseName: '血海听潮',
      description:
        '不拒血海来潮，先听清每一道苦声从何处生，再于回澜时借势渡身。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'blood-lotus',
        level: 1,
      },
    },
    {
      id: 'three-knocks',
      kind: 'active',
      baseName: '三叩业门',
      description: '一叩问因，二叩问果，三叩之后，门内门外皆由一念开合。',
      role: 'combo',
      unlock: {
        type: 'method',
        methodId: 'white-bone',
        level: 3,
      },
    },
    {
      id: 'observe-calamity',
      kind: 'active',
      baseName: '闭目观劫',
      description: '闭目并非不见，而是不被劫相夺去心神；开眼之时，劫已照明。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'wrathful-ming',
        level: 3,
      },
    },
    {
      id: 'five-skandhas',
      kind: 'active',
      baseName: '照见五蕴',
      description:
        '色受想行识逐一照破。佛相辨其虚实，魔相借火自渡，无相令诸蕴俱空。',
      role: 'utility',
      unlock: {
        type: 'method',
        methodId: 'six-senses',
        level: 3,
      },
    },
    {
      id: 'reed-crossing',
      kind: 'active',
      baseName: '一苇横江',
      description:
        '江阔浪急，脚下只留一苇；佛相守住此岸，魔相强渡彼岸，无相则知两岸非岸。',
      role: 'defensive',
      unlock: {
        type: 'method',
        methodId: 'reed-crossing-method',
        level: 3,
      },
    },
    {
      id: 'turn-form',
      kind: 'active',
      baseName: '一念未生',
      description:
        '心念未足时，一念尚伏于心；心念既成，佛、魔与无相只在翻掌之间。',
      role: 'finisher',
      unlock: {
        type: 'method',
        methodId: 'wuxiang-canon',
        level: 5,
      },
    },
    {
      id: 'wuxiang-runtime',
      kind: 'passive',
      baseName: '不坏色身',
      description:
        '色身即是道场：最大气血提高，身陷危境时更能承受迎面而来的伤害。',
      role: 'defensive',
      unlock: {
        type: 'always',
      },
      visibility: 'internal',
    },
    {
      id: 'mirror-core',
      kind: 'passive',
      baseName: '明镜照业',
      description: '来力皆留其痕，因满果熟时照还来处。',
      role: 'defensive',
      unlock: {
        type: 'active_path',
        pathId: 'mirror-karma',
      },
      visibility: 'internal',
    },
    {
      id: 'demon-core',
      kind: 'passive',
      baseName: '魔心渡厄',
      description: '以气血作舟、心念作楫，于一息将尽之际横渡生死。',
      role: 'combo',
      unlock: {
        type: 'active_path',
        pathId: 'demon-crossing',
      },
      visibility: 'internal',
    },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'wuxiang-canon': 5,
      'blood-lotus': 3,
      'white-bone': 3,
      'wrathful-ming': 3,
      'six-senses': 3,
      'reed-crossing-method': 3,
    },
    initialAbilityLoadout: [
      'turn-form',
      'blood-tide',
      'three-knocks',
      'observe-calamity',
    ],
  },
  paths: [
    {
      id: 'mirror-karma',
      name: '明镜照业',
      description:
        '以承受制造因，以魔相兑现果。来力不急于拒绝，只把每一道因果留在镜中；佛相立因，魔相现报，无相令因果同时照见。',
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
      defaultTacticId: 'guard',
      tactics: [
        {
          id: 'guard',
          name: '守镜',
          description:
            '优先保持3层业痕与防守状态；3层业痕且达到3点心念，或达到5点心念后入魔，优先使用防御神通维持血线。',
        },
        {
          id: 'present',
          name: '现报',
          description:
            '至少1层业痕且达到3点心念便入魔，优先使用可即时消费业痕的攻击神通。',
        },
        {
          id: 'formless',
          name: '无相',
          description:
            '原则上积满6点心念再显无相；低于35%气血且已有3点心念时允许提前入魔自救。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '受击留业',
            description: '佛相承受敌方直接伤害，积累业痕并即时返还部分来力。',
          },
          {
            name: '逐层现报',
            description:
              '佛相奠定招式根基；显化魔相时照见现报，显化无相时再现最终变化。',
          },
          {
            name: '一念两照',
            description:
              '显化无相时，同一门神通会兼具佛相本式、魔相变化与无相变化。',
          },
        ],
        abilityChanges: {
          'flower-heart':
            '佛相伤敌并留下叩心戒；魔相借业痕问罪追击、封住敌招；无相再发一击，并为自身留下业痕。',
          'blood-tide':
            '佛相提供护盾与听潮减伤；魔相消费业痕恢复并登记受击反击；无相额外加厚护盾。',
          'three-knocks':
            '佛相三击并留下新的业门；魔相借业痕引爆目标原有的业门；无相在旧门尽空后再发一击。',
          'observe-calamity':
            '佛相架势抵御一次直接伤害；魔相消费业痕令减伤同时反击；无相将架势扩展为两次。',
          'five-skandhas':
            '佛相伤敌并驱散敌方增益；魔相借业痕净化自身；无相额外伤敌并获得护盾。',
          'reed-crossing':
            '佛相保护下一次直接受击；魔相消费业痕令防护触发时反击；无相额外获得护盾。',
          'turn-form':
            '3～5点心念可使之后两门神通显化魔相；6点心念可使下一门神通显化无相。',
        },
      },
      nodes: [
        {
          id: 'mirror-vow-body',
          layerId: '1',
          name: '戒由身起',
          description:
            '所有佛相神通气血成本提高1个百分点；成功施展后获得2%最大气血护盾。',
        },
        {
          id: 'mirror-guest-in-mirror',
          layerId: '1',
          name: '镜中留客',
          description: '每轮首次受到敌方直接伤害时，额外留下1层业痕。',
        },
        {
          id: 'mirror-fruit-in-time',
          layerId: '1',
          name: '果不逾时',
          description: '每层业痕提供的佛相反伤比例由3%提高至4%。',
        },
        {
          id: 'mirror-loud-flower',
          layerId: '2',
          name: '花落有声',
          description: '叩心戒的伤害衰减由10%提高至18%。',
        },
        {
          id: 'mirror-welcome-tide',
          layerId: '2',
          name: '潮来不拒',
          description: '血海听潮的直接伤害减免由15%提高至25%。',
        },
        {
          id: 'mirror-fourth-knock',
          layerId: '2',
          name: '门叩第四声',
          description:
            '三叩业门额外留下第四层业门；倒叩时允许追加第四段明确伤害。',
        },
        {
          id: 'mirror-see-guest',
          layerId: '3',
          name: '闭目见客',
          description: '闭目观劫首次直接伤害减免由35%提高至50%。',
        },
        {
          id: 'mirror-skandhas-mark',
          layerId: '3',
          name: '蕴去痕留',
          description: '照见五蕴成功驱散增益时获得2层业痕。',
        },
        {
          id: 'mirror-carry-karma',
          layerId: '3',
          name: '一苇载业',
          description: '一苇横江的直接伤害减免由40%提高至50%。',
        },
        {
          id: 'mirror-form-beyond',
          layerId: '4',
          name: '相外有相',
          description: '魔相止观的直接伤害减免由20%提高至30%。',
        },
        {
          id: 'mirror-back-demon',
          layerId: '4',
          name: '镜背生魔',
          description:
            '每次进入魔相时，第一门神通无需消耗业痕，也能触发一次现报；无相不受影响。',
        },
        {
          id: 'mirror-formless-two',
          layerId: '4',
          name: '一念两照',
          description:
            '成功施展无相神通后额外获得2层业痕；《一念无间》气血成本增加2个百分点。',
        },
        {
          id: 'mirror-full-light',
          layerId: '5',
          name: '业满成光',
          description: '业痕满层时，佛相即时反伤额外提高5%。',
        },
        {
          id: 'mirror-fast-fruit',
          layerId: '5',
          name: '现报无迟',
          description:
            '现报成功后，攻击神通额外造成0.20倍物攻伤害；自身防御神通额外获得4%最大气血护盾。',
        },
        {
          id: 'mirror-return-source',
          layerId: '5',
          name: '照还来处',
          description:
            '每次实际消耗1层业痕触发现报时，恢复2%最大气血；免费现报不触发。',
        },
        {
          id: 'mirror-not-platform',
          layerId: 'ultimate',
          name: '明镜非台',
          description: '佛相且业痕满层时，受到的直接伤害降低10%。',
        },
        {
          id: 'mirror-all-karma',
          layerId: 'ultimate',
          name: '万业同门',
          description:
            '无相现报实际消耗业痕后，会再尝试消耗1层；成功时攻击神通额外造成0.60倍物攻伤害，防御神通获得8%最大气血护盾。',
        },
        {
          id: 'mirror-return-thought',
          layerId: 'ultimate',
          name: '来去一念',
          description: '成功施展无相神通后返还2点心念。',
        },
      ],
    },
    {
      id: 'demon-crossing',
      name: '魔心渡厄',
      description:
        '以佛相主动沉血，以魔相强渡两息，以无相令燃血与渡厄同时显化。气血不是怒气的别名，而是每一门神通真正支付的渡河之资。',
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
      defaultTacticId: 'trial-fire',
      tactics: [
        {
          id: 'trial-fire',
          name: '试火',
          description:
            '达到3点心念且低于65%气血时入魔；危急时先以攻击吸血，再用防御神通稳住血线。',
        },
        {
          id: 'sink-boat',
          name: '沉舟',
          description:
            '尽量积至5点心念并主动压至50%气血以下，入魔后优先连续使用攻击神通收束。',
        },
        {
          id: 'one-thought',
          name: '一念',
          description:
            '优先积满6点心念使用无相；低于30%气血时允许以3点心念提前入魔自救。',
        },
      ],
      presentation: {
        highlights: [
          {
            name: '主动沉血',
            description:
              '佛相支付当前气血施展神通，以真实代价换取心念；防御神通可积蓄更多心念。',
          },
          {
            name: '两息渡厄',
            description:
              '进入魔相后，接下来两门宗门神通都会显现各自的魔相变化，并共享减伤、免控与吸血之效。',
          },
          {
            name: '佛魔同炉',
            description:
              '显化无相时，同一门神通会兼具佛相本式、魔相变化与无相变化。',
          },
        ],
        abilityChanges: {
          'flower-heart':
            '佛相伤敌并留下心隙；魔相再发摘心重击并多留一层心隙；无相根据目标已损气血收束。',
          'blood-tide':
            '佛相重血换取护盾与下一击强化；魔相加厚护盾并令血潮命中回血；无相立即回生并强化血潮。',
          'three-knocks':
            '佛相三击，并在自身气血较低时强化末击；魔相再发一记重击；无相在濒危时发动必定暴击的无生之击。',
          'observe-calamity':
            '佛相降低下一次直接伤害；魔相令承劫后反击；无相再获得护盾。',
          'five-skandhas':
            '佛相净化并在成功时获得心念；魔相获得护盾与下一击强化；无相再净化一个减益。',
          'reed-crossing':
            '佛相获得护盾与下一击减伤；魔相进一步强化两者；无相在濒危时恢复气血。',
          'turn-form':
            '3～5点心念可无额外气血成本进入魔相两式并获得渡厄护体与护盾；6点心念可支付少量气血使下一门神通显化无相。',
        },
      },
      nodes: [
        {
          id: 'demon-blood-oil',
          layerId: '1',
          name: '血作灯油',
          description:
            '所有佛相神通气血成本提高1个百分点；成功施展后获得2%最大气血护盾。',
        },
        {
          id: 'demon-three-shores',
          layerId: '1',
          name: '三岸留痕',
          description:
            '每场战斗首次因自身神通成本降至35%气血以下时，获得8%最大气血护盾。',
        },
        {
          id: 'demon-bone-tide',
          layerId: '1',
          name: '潮伏骨中',
          description: '血海听潮获得的基础护盾由10%提高至15%最大气血。',
        },
        {
          id: 'demon-flower-inward',
          layerId: '2',
          name: '花开向内',
          description: '心隙令下一次宗门直接伤害提高25%。',
        },
        {
          id: 'demon-no-return-tide',
          layerId: '2',
          name: '潮不回头',
          description:
            '血海听潮生成的下一门宗门直接伤害加成由20%提高至30%；无相仍以30%为准。',
        },
        {
          id: 'demon-third-outside',
          layerId: '2',
          name: '门外三声',
          description: '三叩业门强化第三击的气血线由45%提高至55%。',
        },
        {
          id: 'demon-slow-fire',
          layerId: '3',
          name: '劫火缓行',
          description: '闭目观劫的直接伤害减免由40%提高至50%。',
        },
        {
          id: 'demon-skandhas-fuel',
          layerId: '3',
          name: '五蕴作薪',
          description:
            '照见五蕴的佛相净化数量由1提高至2；显化无相时共净化3个减益。',
        },
        {
          id: 'demon-short-reed',
          layerId: '3',
          name: '苇短水长',
          description:
            '一苇横江的佛相直接伤害减免由20%提高至30%；魔相最终提高到40%。',
        },
        {
          id: 'demon-first-thought',
          layerId: '4',
          name: '第一念魔',
          description:
            '进入魔相或无相时获得第一念：下一门攻击神通额外造成0.35倍物攻伤害，防御神通获得5%最大气血护盾。',
        },
        {
          id: 'demon-second-shore',
          layerId: '4',
          name: '第二岸苦',
          description:
            '魔相期间每成功施展一门宗门神通，恢复2.5%最大气血；无相仅触发一次。',
        },
        {
          id: 'demon-two-gates',
          layerId: '4',
          name: '两门同渡',
          description: '进入魔相时获得的护盾由6%提高至10%最大气血。',
        },
        {
          id: 'demon-body-breaks',
          layerId: '5',
          name: '身坏心明',
          description:
            '每场战斗首次因自身神通成本降至30%气血以下时，获得1回合控制免疫。',
        },
        {
          id: 'demon-blood-empty',
          layerId: '5',
          name: '血尽潮生',
          description:
            '每场战斗首次因自身神通成本降至25%气血以下时，恢复5%最大气血。',
        },
        {
          id: 'demon-leave-boat',
          layerId: '5',
          name: '渡后留舟',
          description: '魔相结束时获得6%最大气血护盾；无相结束不触发。',
        },
        {
          id: 'demon-one-furnace',
          layerId: 'ultimate',
          name: '佛魔同炉',
          description:
            '强化六门神通的无相变化，使收束伤害、恢复、护盾或净化获得提升。',
        },
        {
          id: 'demon-no-gap',
          layerId: 'ultimate',
          name: '一息无间',
          description:
            '魔相与无相的单行动吸血上限提高至12%最大气血，但渡厄直接伤害减免由20%降低至10%。',
        },
        {
          id: 'demon-look-back',
          layerId: 'ultimate',
          name: '回首彼岸',
          description:
            '魔相或无相结束时，若存活且低于20%气血，恢复5%最大气血；每次转相最多一次。',
        },
      ],
    },
  ],
};
