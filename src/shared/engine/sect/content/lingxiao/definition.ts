import type { SectDefinition } from '../../core/domain';

/** 组织身份与历史进度映射；战斗内容由 combat-v6 提供。 */
export const LINGXIAO_DEFINITION: SectDefinition = {
  id: 'lingxiao',
  name: '红尘剑宗',
  description:
    '从红尘中学剑，向红尘中还剑。门人以平生所见养成剑意，于照影游尘、守拙藏锋二道中自定剑途。',
  raceIds: ['human'],
  configVersion: 4,
  methods: [
    {
      id: 'lingxiao-canon',
      slot: 1,
      name: '《红尘剑录》',
      isPrimary: true,
      description:
        '历代门人将一生所见与问剑所得录入其中。此录不定剑招，只论剑从何起、当向何处。',
    },
    {
      id: 'sword-guidance',
      slot: 3,
      name: '《剑气长歌》',
      description: '以气驭剑，使锋芒连绵不绝；剑气养于胸臆，动时如长风振野。',
    },
    {
      id: 'void-step',
      slot: 4,
      name: '《凌虚步》',
      description: '御气踏虚，身随剑走；方寸之间腾挪换位，不使自身困于敌势。',
    },
    {
      id: 'edge-cleansing',
      slot: 2,
      name: '《观微剑意》',
      description: '静观一息之变，明察毫厘之机；敌势未成，破绽已映于剑心。',
    },
    {
      id: 'origin-returning',
      slot: 5,
      name: '《澄心剑诀》',
      description: '收束心神，使剑意澄明；外法虽变化万端，不能动摇持剑之念。',
    },
    {
      id: 'sword-nurturing',
      slot: 6,
      name: '《不灭剑体》',
      description: '以身作剑，以骨为脊，经千锤百炼而锋芒不折、形神不摧。',
    },
  ],
  abilities: [
    {
      id: 'plain-sword',
      kind: 'default',
      baseName: '问剑式',
      description:
        '红尘剑宗入门第一式。招式简明，不求出奇，重在出剑之前先明来意。',
      unlock: {
        type: 'method',
        methodId: 'lingxiao-canon',
        level: 1,
      },
      role: 'generator',
    },
    {
      id: 'sect-ultimate',
      kind: 'active',
      baseName: '此剑平生',
      description: '剑意至极，平生所见皆归于一锋。此剑不借天威，只决眼前之局。',
      unlock: {
        type: 'method',
        methodId: 'lingxiao-canon',
        level: 10,
      },
      role: 'finisher',
    },
    {
      id: 'guiding-sword',
      kind: 'active',
      baseName: '剑起沧澜',
      description: '剑意初动，如沧海生澜；一势既起，后招便随之而来。',
      unlock: {
        type: 'method',
        methodId: 'sword-guidance',
        level: 1,
      },
      role: 'generator',
    },
    {
      id: 'linked-edge',
      kind: 'active',
      baseName: '剑荡山河',
      description: '剑锋纵横，数势相连；前剑未尽，后剑已越其锋。',
      unlock: {
        type: 'method',
        methodId: 'sword-guidance',
        level: 5,
      },
      role: 'combo',
    },
    {
      id: 'turning-body',
      kind: 'active',
      baseName: '藏锋听雷',
      description: '收剑藏势，静候敌招；待来势真正落下，再以后发之剑应之。',
      unlock: {
        type: 'method',
        methodId: 'void-step',
        level: 3,
      },
      role: 'defensive',
    },
    {
      id: 'shadow-step',
      kind: 'active',
      baseName: '踏雪无痕',
      description: '身随剑行，进退不滞；剑光掠过之后，唯余风雪未定。',
      unlock: {
        type: 'method',
        methodId: 'void-step',
        level: 5,
      },
      role: 'generator',
    },
    {
      id: 'breaking-edge',
      kind: 'active',
      baseName: '一剑破妄',
      description: '剑意照见虚实，以锋芒截断敌方变化，使诸般护持无所藏形。',
      unlock: {
        type: 'method',
        methodId: 'edge-cleansing',
        level: 3,
      },
      role: 'utility',
    },
    {
      id: 'sword-aegis',
      kind: 'active',
      baseName: '剑心通明',
      description: '心念澄澈，剑意自明；外法临身，只见其变，不为其所动。',
      unlock: {
        type: 'method',
        methodId: 'origin-returning',
        level: 3,
      },
      role: 'defensive',
    },
    {
      id: 'nurturing-sword',
      kind: 'active',
      baseName: '人剑合一',
      description: '气随意转，意随剑行；持剑之人与手中之锋再无迟滞。',
      unlock: {
        type: 'method',
        methodId: 'sword-nurturing',
        level: 3,
      },
      role: 'defensive',
    },
    {
      id: 'lingxiao-runtime',
      kind: 'passive',
      baseName: '剑骨淬锋',
      description: '以剑意淬炼筋骨，常驻提高暴击率与物理穿透。',
      role: 'combo',
      unlock: {
        type: 'always',
      },
      visibility: 'internal',
    },
    {
      id: 'heavy-shield-momentum',
      kind: 'passive',
      baseName: '大巧不工',
      description: '护盾吸收直接伤害后，每回合获得一点剑意。',
      role: 'defensive',
      unlock: {
        type: 'active_path',
        pathId: 'heavy-sword',
      },
      visibility: 'internal',
    },
  ],
  onboarding: {
    initialContribution: 30,
    initialMethods: {
      'lingxiao-canon': 5,
      'sword-guidance': 1,
      'void-step': 1,
      'edge-cleansing': 1,
      'origin-returning': 1,
      'sword-nurturing': 1,
    },
    initialAbilityLoadout: ['guiding-sword', null, null, null],
  },
  paths: [
    {
      id: 'swift-sword',
      name: '照影游尘',
      description:
        '剑随身走，身随势变；以迅疾剑式连缀攻势，在交锋之间留下剑痕，最终将诸般剑影收束于《此剑平生》。',
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
      defaultTacticId: 'aggressive',
      presentation: {
        highlights: [
          {
            name: '连击留痕',
            description: '以迅疾连击施加剑痕。',
          },
          {
            name: '身法借势',
            description: '以身法、闪避与反击维持攻势。',
          },
          {
            name: '诸影归剑',
            description: '将剑意转化为连续斩击。',
          },
        ],
        abilityChanges: {
          'plain-sword': '牺牲少量基础威力，维持稳定积势。',
          'sect-ultimate': '将剑意凝为一记主斩，并可引爆剑痕追加伤害。',
          'guiding-sword': '身法高于目标时追加追击，强化抢攻能力。',
          'linked-edge': '改为三段连击，获得更多剑意并施加剑痕，不再进入调息。',
          'turning-body': '改为先攻后守；短暂提高闪避，首次闪避时反击并积势。',
          'shadow-step': '进一步提高身法与闪避，首次闪避时额外积势。',
          'breaking-edge': '维持基础威力与驱散能力。',
          'sword-aegis': '降低部分法术防御，改以额外闪避替代控制抗性。',
          'nurturing-sword': '降低部分物攻增幅，同时提高身法。',
        },
      },
      tactics: [
        {
          id: 'aggressive',
          name: '追风',
          description:
            '剑意达到3点即可施展《此剑平生》，优先追击气血较低的目标。',
        },
        {
          id: 'steady',
          name: '连势',
          description: '剑痕不足2层时优先补痕，达到6点剑意且剑痕充足后收束。',
        },
        {
          id: 'counter',
          name: '回燕',
          description:
            '优先补《藏锋听雷》；身法不占优且《踏雪无痕》缺失时，先踏雪再施展《剑荡山河》；剑意达到5点后收束。',
        },
      ],
      nodes: [
        {
          id: 'swift-opening',
          layerId: '1',
          name: '风起',
          description: '战斗开始时获得2点剑意；首回合身法提高8%。',
        },
        {
          id: 'swift-hidden-edge',
          layerId: '1',
          name: '敛锋',
          description:
            '本场战斗首次受到直接伤害时，该次伤害降低10%，并获得3点剑意。',
        },
        {
          id: 'swift-probing-edge',
          layerId: '1',
          name: '探虚',
          description:
            '《问剑式》每累计命中2次，额外获得1点剑意，并施加1层随《红尘剑录》成长的剑痕。',
        },
        {
          id: 'swift-split-light',
          layerId: '2',
          name: '分光',
          description:
            '《剑荡山河》维持3段攻击并获得3点剑意；总伤害随《剑气长歌》成长。',
        },
        {
          id: 'swift-stacking-waves',
          layerId: '2',
          name: '叠浪',
          description: '施展《剑荡山河》后，其当前冷却减少1回合。',
        },
        {
          id: 'swift-retained-force',
          layerId: '2',
          name: '留痕',
          description: '《剑荡山河》额外施加1层剑痕，共施加2层。',
        },
        {
          id: 'swift-returning-swallow',
          layerId: '3',
          name: '燕返',
          description:
            '提高《藏锋听雷》的首次闪避反击伤害，命中后施加1层随《红尘剑录》成长的剑痕。',
        },
        {
          id: 'swift-borrowed-force',
          layerId: '3',
          name: '借风',
          description: '每回合首次受到直接伤害时，获得1点剑意。',
        },
        {
          id: 'swift-guarded-edge',
          layerId: '3',
          name: '守锋',
          description:
            '被控制而跳过行动时剑意不衰减；下一次通过积势神通获得剑意时额外获得1点。',
        },
        {
          id: 'swift-mountain-breaking',
          layerId: '4',
          name: '破妄',
          description:
            '施展《此剑平生》时消耗全部剑痕；每消耗1层，追加一次随《红尘剑录》成长且无视防御的伤害。',
        },
        {
          id: 'swift-life-chasing',
          layerId: '4',
          name: '追命',
          description: '目标气血低于25%时，《此剑平生》造成的伤害提高15%。',
        },
        {
          id: 'swift-sheathing',
          layerId: '4',
          name: '归鞘',
          description:
            '《此剑平生》伤害降低15%，施展后返还2点剑意，并获得随《红尘剑录》成长的护盾。剑有出时，也应有归处。',
        },
        {
          id: 'swift-gapless',
          layerId: '5',
          name: '无隙',
          description:
            '施展《此剑平生》后，下一次《剑起沧澜》不消耗法力，并额外获得1点剑意。',
        },
        {
          id: 'swift-linked-city',
          layerId: '5',
          name: '连城',
          description:
            '施展《剑荡山河》后，其他快剑神通的当前冷却减少1回合，每回合最多触发一次。',
        },
        {
          id: 'swift-still-tide',
          layerId: '5',
          name: '静潮',
          description:
            '连续两次自身行动未施展《此剑平生》后，暂停剑意衰减；下一次《此剑平生》伤害提高15%。',
        },
        {
          id: 'swift-endless-flow',
          layerId: 'ultimate',
          name: '无间',
          description:
            '施展《此剑平生》后，追加随《红尘剑录》成长的追击并获得1点剑意，每3回合最多触发一次。',
        },
        {
          id: 'swift-shadow-line',
          layerId: 'ultimate',
          name: '绝影',
          description:
            '以6点剑意施展《此剑平生》时，总伤害降低15%，全部伤害段必定暴击，冷却增加1回合。',
        },
        {
          id: 'swift-unending-wind',
          layerId: 'ultimate',
          name: '回风',
          description:
            '每次《藏锋听雷》持续期间首次闪避时，获得随《凌虚步》成长的护盾，并施加1层剑痕。',
        },
      ],
    },
    {
      id: 'heavy-sword',
      name: '守拙藏锋',
      description:
        '重剑不争一时之快，以身承势，以守养锋；剑意未足时稳住自身，剑意既成后，以一剑决定胜负。',
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
      defaultTacticId: 'heavy-break',
      presentation: {
        highlights: [
          {
            name: '护体养锋',
            description: '以护盾吸收伤害并积蓄剑意。',
          },
          {
            name: '后发制人',
            description: '在承受敌势后发动反击。',
          },
          {
            name: '重锋定局',
            description: '将剑意汇于高倍率单段爆发。',
          },
        ],
        abilityChanges: {
          'plain-sword': '提高基础威力，维持稳定积势。',
          'sect-ultimate': '提高剑意转化倍率，强化单段爆发。',
          'guiding-sword': '提高威力并获得护盾，但增加冷却。',
          'linked-edge':
            '由三段连击改为单段重击，并获得护盾；冷却增加，但不再进入调息。',
          'turning-body': '保留先守后攻，进一步提高直接伤害减免。',
          'shadow-step': '由身法闪避强化改为护盾、物防与积势。',
          'breaking-edge': '提高攻击威力，保留驱散能力。',
          'sword-aegis': '提高法术防御并降低直接伤害，但不再提供控制抗性。',
          'nurturing-sword': '降低部分物攻增幅，同时提高物防。',
        },
      },
      tactics: [
        {
          id: 'heavy-break',
          name: '后发',
          description:
            '优先施展《藏锋听雷》，围绕受到伤害与反击积蓄剑意，达到3点后即可收束。',
        },
        {
          id: 'heavy-full',
          name: '极势',
          description:
            '4点剑意起且裂甲不足2层时，提前准备《藏锋听雷》；6点剑意但裂甲仍不足时先补甲，满足后以《此剑平生》收束。',
        },
        {
          id: 'heavy-guard',
          name: '守山',
          description:
            '无护盾时优先《踏雪无痕》；气血低于65%且《剑心通明》缺失时施展剑心；剑意达到5点后收束。',
        },
      ],
      nodes: [
        {
          id: 'heavy-opening',
          layerId: '1',
          name: '立地',
          description: '战斗开始时获得1点剑意，并获得相当于35%物攻的护盾。',
        },
        {
          id: 'heavy-hidden-weight',
          layerId: '1',
          name: '承锋',
          description:
            '本场战斗首次受到直接伤害时，该次伤害降低15%，并获得2点剑意。',
        },
        {
          id: 'heavy-testing-frame',
          layerId: '1',
          name: '守拙',
          description:
            '每回合首次护盾破裂时，额外获得1点剑意。不争一时得失，以守势积成后手。',
        },
        {
          id: 'heavy-triple-ridge',
          layerId: '2',
          name: '蓄岳',
          description:
            '提高《藏锋听雷》蓄势期间随《凌虚步》成长的直接伤害减免。',
        },
        {
          id: 'heavy-shattering-armor',
          layerId: '2',
          name: '听雷',
          description: '提高《藏锋听雷》的后发攻击，并使其共施加2层裂甲。',
        },
        {
          id: 'heavy-retained-frame',
          layerId: '2',
          name: '守心',
          description:
            '施展《藏锋听雷》开始蓄势时，获得随《凌虚步》成长的护盾。',
        },
        {
          id: 'heavy-crossing-pass',
          layerId: '3',
          name: '镇关',
          description: '《踏雪无痕》提供的护盾提高50%。',
        },
        {
          id: 'heavy-borrowed-weight',
          layerId: '3',
          name: '回澜',
          description:
            '护盾破裂时，反击造成相当于75%物攻的伤害，每回合最多触发一次。',
        },
        {
          id: 'heavy-unmoved',
          layerId: '3',
          name: '固守',
          description: '拥有护盾时，受到的直接伤害降低10%。',
        },
        {
          id: 'heavy-rending-mountain',
          layerId: '4',
          name: '横关',
          description:
            '每回合首次以护盾吸收直接伤害时，反击造成相当于55%物攻的伤害，并获得1点剑意。',
        },
        {
          id: 'heavy-ending-life',
          layerId: '4',
          name: '借力',
          description:
            '返还本次护盾吸收量20%的伤害，反击伤害不超过相当于60%物攻。',
        },
        {
          id: 'heavy-returning-peak',
          layerId: '4',
          name: '震锋',
          description:
            '每回合首次受到直接伤害时，反击造成相当于40%物攻的伤害，并驱散敌方1个正面状态。',
        },
        {
          id: 'heavy-aftershock',
          layerId: '5',
          name: '裂岳',
          description: '《此剑平生》获得15%穿防。',
        },
        {
          id: 'heavy-linked-mountains',
          layerId: '5',
          name: '断命',
          description: '目标气血低于25%时，《此剑平生》造成的伤害提高15%。',
        },
        {
          id: 'heavy-steady-mountain',
          layerId: '5',
          name: '回峰',
          description:
            '《此剑平生》伤害降低15%，施展后返还2点剑意，并获得随《红尘剑录》成长的护盾。',
        },
        {
          id: 'heavy-heaven-cleaving',
          layerId: 'ultimate',
          name: '开天',
          description:
            '《此剑平生》改为仅可在6点剑意时施展，提高随《红尘剑录》成长的总倍率并获得20%穿防；冷却增加1回合。',
        },
        {
          id: 'heavy-immovable-mountain',
          layerId: 'ultimate',
          name: '不动如山',
          description:
            '《剑心通明》额外提供随《万法不侵》成长的护盾；持续期间每回合可反击一次，造成随该心法成长的伤害。',
        },
        {
          id: 'heavy-mountain-river-echo',
          layerId: 'ultimate',
          name: '山河回响',
          description:
            '施展《此剑平生》后恢复气血并获得随《红尘剑录》成长的护盾，每3回合最多触发一次。',
        },
      ],
    },
  ],
};
