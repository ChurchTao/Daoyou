import type {
  ExorcismBossId,
  ExorcismBuildTag,
  ExorcismLineageId,
} from '@daoyou/game-domain/dungeon/exorcism';

export type ExorcismEnemyModifiers = Partial<
  Record<'hp' | 'physicalDef' | 'magicDef' | 'speed' | 'dodge', number>
>;

/** 一个敌人。份额之和按场内所有敌人归一；预算属于整场。 */
export interface ExorcismEnemyDef {
  name: string;
  /** 立绘键，对应 public/assets/mystery/portraits。 */
  portrait: string;
  hpShare: number;
  outputShare: number;
  modifiers?: ExorcismEnemyModifiers;
  passives?: string[];
  cycle: string[];
  fallback: 'attack' | 'defend';
}

export interface ExorcismEncounterDef {
  /** 多敌编组的整场气血折价，默认 1。 */
  hpScale?: number;
  enemies: ExorcismEnemyDef[];
}

export interface ExorcismBossDef {
  id: ExorcismBossId;
  name: string;
  portrait: string;
  /** 本祟脉的节点更容易遇到它；缺省表示所有祟脉权重相同。 */
  lineageId?: ExorcismLineageId;
  /** 只有明显克制某种构筑的首领才写，空表示对谁都一样难。克星应当是少数局。 */
  counters: ExorcismBuildTag[];
  /** 现形页的一句机制说明。 */
  mechanic: string;
  /** 克星印下面的一句提示。 */
  counterLine?: string;
  /** 第三战：护法预演首领机制。 */
  guardian: ExorcismEncounterDef;
  boss: ExorcismEncounterDef;
}

export const EXORCISM_BOSSES: Record<ExorcismBossId, ExorcismBossDef> = {
  withered_vine: {
    id: 'withered_vine',
    name: '枯藤老祟',
    portrait: 'manifest-grass',
    lineageId: 'grass',
    counters: ['sustain'],
    mechanic:
      '不断种下寄生并叠层，寄生压低受疗，枯荣时按层数爆发。驱散寄生或尽快击杀。',
    counterLine: '此祟专克靠治疗久战的打法。',
    guardian: {
      enemies: [
        {
          name: '缠根藤妖',
          portrait: 'yaoguai',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.vine.parasite',
            'exorcism.grass.lash',
            'exorcism.grass.lash',
          ],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '枯藤老祟',
          portrait: 'manifest-grass',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.vine.parasite',
            'exorcism.grass.lash',
            'exorcism.vine.parasite',
            'exorcism.vine.bloom',
          ],
          fallback: 'attack',
        },
      ],
    },
  },
  broken_vein: {
    id: 'broken_vein',
    name: '断脉石魁',
    portrait: 'manifest-earth',
    lineageId: 'earth',
    counters: ['physical'],
    mechanic:
      '蓄势、重击、露出破绽，三拍一循环；物防很高。蓄势后防御，破绽时反击。',
    counterLine: '此祟专克刀剑。',
    guardian: {
      enemies: [
        {
          name: '断脉岩傀',
          portrait: 'puppet',
          hpShare: 1,
          outputShare: 1,
          modifiers: { physicalDef: 1.25 },
          cycle: ['attack', 'exorcism.vein.charge', 'exorcism.vein.heavy-lite'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '断脉石魁',
          portrait: 'manifest-earth',
          hpShare: 1,
          outputShare: 1,
          modifiers: { physicalDef: 1.6 },
          cycle: ['attack', 'exorcism.vein.charge', 'exorcism.vein.heavy'],
          fallback: 'attack',
        },
      ],
    },
  },
  soul_shadow: {
    id: 'soul_shadow',
    name: '噬灵魔影',
    portrait: 'manifest-demonic',
    lineageId: 'demonic',
    counters: ['spell'],
    mechanic:
      '每次噬灵都烧掉大量法力并留下灵损，灵损越多受到的法术伤害越高。法力要省着用。',
    counterLine: '此祟专克耗蓝的术法。',
    guardian: {
      enemies: [
        {
          name: '噬灵妖修',
          portrait: 'wanderer-m',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.shadow.burn-lite',
            'exorcism.demonic.drain',
            'exorcism.demonic.drain',
          ],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '噬灵魔影',
          portrait: 'manifest-demonic',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.shadow.burn',
            'exorcism.demonic.drain',
            'exorcism.shadow.burn',
            'exorcism.demonic.drain',
          ],
          fallback: 'attack',
        },
      ],
    },
  },
  mirror_lord: {
    id: 'mirror_lord',
    name: '镜阵尊主',
    portrait: 'elder-m',
    counters: ['single_target'],
    mechanic: '两名镜侍各提供大量减伤。先除镜侍，减伤才会消失；群攻最顺手。',
    counterLine: '此祟专克只会单打的构筑。',
    guardian: {
      hpScale: 0.9,
      enemies: [
        {
          name: '镜阵执事',
          portrait: 'elder-f',
          hpShare: 0.75,
          outputShare: 0.85,
          passives: ['exorcism.mirror.master'],
          cycle: ['exorcism.mirror.strike', 'attack', 'exorcism.mirror.double'],
          fallback: 'attack',
        },
        {
          name: '镜侍',
          portrait: 'disciple-f',
          hpShare: 0.25,
          outputShare: 0.15,
          passives: ['exorcism.mirror.guard'],
          cycle: ['exorcism.mirror.light'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      hpScale: 0.8,
      enemies: [
        {
          name: '镜阵尊主',
          portrait: 'elder-m',
          hpShare: 0.7,
          outputShare: 0.8,
          passives: ['exorcism.mirror.master'],
          cycle: [
            'exorcism.mirror.strike',
            'exorcism.mirror.strike',
            'exorcism.mirror.double',
          ],
          fallback: 'attack',
        },
        {
          name: '镜侍',
          portrait: 'disciple-m',
          hpShare: 0.15,
          outputShare: 0.1,
          passives: ['exorcism.mirror.guard'],
          cycle: ['exorcism.mirror.light'],
          fallback: 'attack',
        },
        {
          name: '镜侍',
          portrait: 'disciple-f',
          hpShare: 0.15,
          outputShare: 0.1,
          passives: ['exorcism.mirror.guard'],
          cycle: ['exorcism.mirror.light'],
          fallback: 'attack',
        },
      ],
    },
  },
  tide_serpent: {
    id: 'tide_serpent',
    name: '潮汐蛟影',
    portrait: 'manifest-water',
    lineageId: 'water',
    counters: [],
    mechanic:
      '单数回合物理减伤，双数回合法术减伤。看回合换招，物法兼修最顺手。',
    guardian: {
      enemies: [
        {
          name: '潮魅',
          portrait: 'spirit',
          hpShare: 1,
          outputShare: 1,
          passives: ['exorcism.tide.cycle'],
          cycle: ['exorcism.water.bolt', 'attack'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '潮汐蛟影',
          portrait: 'manifest-water',
          hpShare: 1,
          outputShare: 1,
          passives: ['exorcism.tide.cycle'],
          cycle: [
            'exorcism.water.bolt',
            'exorcism.tide.surge',
            'exorcism.water.bolt',
          ],
          fallback: 'attack',
        },
      ],
    },
  },
  gilded_corpse: {
    id: 'gilded_corpse',
    name: '金身尸王',
    portrait: 'manifest-corpse',
    lineageId: 'corpse',
    counters: [],
    mechanic:
      '金身不惧刀剑术法，气血却不多，倒下后还会再起一次。固定伤害最奏效。',
    guardian: {
      enemies: [
        {
          name: '守陵尸将',
          portrait: 'servant-m',
          hpShare: 1,
          outputShare: 1,
          modifiers: { hp: 0.8, physicalDef: 1.25, magicDef: 1.25 },
          passives: ['exorcism.corpse.rise'],
          cycle: ['exorcism.corpse.claw', 'attack'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '金身尸王',
          portrait: 'manifest-corpse',
          hpShare: 1,
          outputShare: 1,
          modifiers: { hp: 0.7, physicalDef: 1.45, magicDef: 1.45 },
          passives: ['exorcism.corpse.rise'],
          cycle: ['exorcism.corpse.claw', 'attack', 'exorcism.corpse.claw'],
          fallback: 'attack',
        },
      ],
    },
  },
  heretic: {
    id: 'heretic',
    name: '噬灵邪修',
    portrait: 'wanderer-m',
    counters: [],
    mechanic: '护法每回合都替邪修疗伤。先除护法或封住护法，才打得动邪修。',
    guardian: {
      hpScale: 0.9,
      enemies: [
        {
          name: '邪修刀客',
          portrait: 'wanderer-f',
          hpShare: 0.7,
          outputShare: 0.85,
          cycle: ['exorcism.mirror.strike', 'attack'],
          fallback: 'attack',
        },
        {
          name: '噬灵学徒',
          portrait: 'disciple-m',
          hpShare: 0.3,
          outputShare: 0.15,
          cycle: ['exorcism.heretic.heal-lite', 'exorcism.mirror.light'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      hpScale: 0.85,
      enemies: [
        {
          name: '噬灵邪修',
          portrait: 'wanderer-m',
          hpShare: 0.72,
          outputShare: 0.88,
          cycle: ['exorcism.water.bolt', 'exorcism.mirror.strike'],
          fallback: 'attack',
        },
        {
          name: '噬灵护法',
          portrait: 'elder-f',
          hpShare: 0.28,
          outputShare: 0.12,
          cycle: ['exorcism.heretic.heal'],
          fallback: 'attack',
        },
      ],
    },
  },
  dream_binder: {
    id: 'dream_binder',
    name: '缚梦幻师',
    portrait: 'noble-f',
    counters: ['spell'],
    mechanic:
      '周期性封住术法，封住时只能普攻、物理技能或防御。定力高的不容易中招。',
    counterLine: '此祟专克靠术法吃饭的构筑。',
    guardian: {
      enemies: [
        {
          name: '缚梦侍女',
          portrait: 'merchant-f',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.water.bolt',
            'exorcism.binder.seal',
            'attack',
            'exorcism.water.bolt',
          ],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '缚梦幻师',
          portrait: 'noble-f',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.binder.seal',
            'exorcism.soul.strike',
            'exorcism.water.bolt',
          ],
          fallback: 'attack',
        },
      ],
    },
  },
  bronze_warden: {
    id: 'bronze_warden',
    name: '铜傀镇守',
    portrait: 'puppet',
    counters: ['physical'],
    mechanic: '物理打它会被反震，段数越多反震越多。用术法打，或者少段数重击。',
    counterLine: '此祟专克刀剑。',
    guardian: {
      enemies: [
        {
          name: '铜傀卫',
          portrait: 'puppet',
          hpShare: 1,
          outputShare: 1,
          passives: ['exorcism.bronze.recoil-lite'],
          cycle: ['attack', 'exorcism.earth.slam'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '铜傀镇守',
          portrait: 'puppet',
          hpShare: 1,
          outputShare: 1,
          modifiers: { magicDef: 0.85 },
          passives: ['exorcism.bronze.recoil'],
          cycle: ['attack', 'exorcism.earth.slam', 'attack'],
          fallback: 'attack',
        },
      ],
    },
  },
  lingering_soul: {
    id: 'lingering_soul',
    name: '残魂守试者',
    portrait: 'spirit',
    counters: [],
    mechanic:
      '身法飘忽，刀剑常常落空，还会周期隐去身形。术法更稳，隐身时先防御。',
    guardian: {
      enemies: [
        {
          name: '残念',
          portrait: 'spirit',
          hpShare: 1,
          outputShare: 1,
          modifiers: { dodge: 1.4 },
          cycle: [
            'exorcism.water.bolt',
            'exorcism.water.bolt',
            'exorcism.soul.fade',
          ],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '残魂守试者',
          portrait: 'spirit',
          hpShare: 1,
          outputShare: 1,
          modifiers: { dodge: 1.8 },
          cycle: [
            'exorcism.water.bolt',
            'exorcism.water.bolt',
            'exorcism.soul.fade',
            'exorcism.soul.strike',
          ],
          fallback: 'attack',
        },
      ],
    },
  },
  mountain_king: {
    id: 'mountain_king',
    name: '山魈王',
    portrait: 'yaoguai',
    counters: [],
    mechanic:
      '带着小妖一起上，小妖死后它会暴怒增伤。一次清场，或者先打山魈王。',
    guardian: {
      hpScale: 0.9,
      enemies: [
        {
          name: '山魈',
          portrait: 'yaoguai',
          hpShare: 0.6,
          outputShare: 0.7,
          passives: ['exorcism.mountain.rage'],
          cycle: ['exorcism.corpse.claw', 'attack'],
          fallback: 'attack',
        },
        {
          name: '小妖',
          portrait: 'yaoguai',
          hpShare: 0.4,
          outputShare: 0.3,
          cycle: ['attack'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '山魈王',
          portrait: 'yaoguai',
          hpShare: 0.6,
          outputShare: 0.66,
          passives: ['exorcism.mountain.rage'],
          cycle: ['exorcism.corpse.claw', 'exorcism.earth.slam', 'attack'],
          fallback: 'attack',
        },
        {
          name: '小妖',
          portrait: 'yaoguai',
          hpShare: 0.2,
          outputShare: 0.17,
          cycle: ['attack'],
          fallback: 'attack',
        },
        {
          name: '小妖',
          portrait: 'yaoguai',
          hpShare: 0.2,
          outputShare: 0.17,
          cycle: ['attack'],
          fallback: 'attack',
        },
      ],
    },
  },
  blood_python: {
    id: 'blood_python',
    name: '血河妖蟒',
    portrait: 'manifest-water',
    counters: ['sustain'],
    mechanic:
      '气血极厚，血牙留下的血毒让治疗大打折扣。久战会被祟蚀拖死，要算好输出。',
    counterLine: '此祟专克靠治疗久战的打法。',
    guardian: {
      enemies: [
        {
          name: '血鳞蟒卫',
          portrait: 'yaoguai',
          hpShare: 1,
          outputShare: 0.85,
          modifiers: { hp: 1.5 },
          cycle: ['exorcism.rot.claw', 'attack'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '血河妖蟒',
          portrait: 'manifest-water',
          hpShare: 1,
          outputShare: 0.75,
          modifiers: { hp: 1.6 },
          cycle: ['exorcism.python.bite', 'attack', 'attack'],
          fallback: 'attack',
        },
      ],
    },
  },
  rot_crone: {
    id: 'rot_crone',
    name: '腐骨药婆',
    portrait: 'servant-f',
    counters: [],
    mechanic:
      '身边的药人皮糙肉厚，药婆的腐骨瘴让治疗越来越差。先打药婆，别陪它耗。',
    guardian: {
      enemies: [
        {
          name: '药人',
          portrait: 'servant-m',
          hpShare: 1,
          outputShare: 0.9,
          modifiers: { hp: 1.4 },
          cycle: ['exorcism.rot.claw', 'attack'],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '腐骨药婆',
          portrait: 'servant-f',
          hpShare: 0.6,
          outputShare: 0.7,
          modifiers: { hp: 1.5 },
          cycle: ['exorcism.rot.mist', 'exorcism.water.bolt'],
          fallback: 'attack',
        },
        {
          name: '药人',
          portrait: 'servant-m',
          hpShare: 0.4,
          outputShare: 0.3,
          modifiers: { hp: 2 },
          cycle: ['exorcism.rot.claw'],
          fallback: 'attack',
        },
      ],
    },
  },
  blood_broker: {
    id: 'blood_broker',
    name: '血契掮客',
    portrait: 'merchant-f',
    counters: [],
    mechanic:
      '开场强塞给你三回合增伤，之后按回合收债掉血，治疗也打折。三回合内打完最划算。',
    guardian: {
      enemies: [
        {
          name: '讨债人',
          portrait: 'merchant-m',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.broker.contract-lite',
            'attack',
            'attack',
            'attack',
            'attack',
            'attack',
          ],
          fallback: 'attack',
        },
      ],
    },
    boss: {
      enemies: [
        {
          name: '血契掮客',
          portrait: 'merchant-f',
          hpShare: 1,
          outputShare: 1,
          cycle: [
            'exorcism.broker.contract',
            'attack',
            'exorcism.mirror.strike',
            'attack',
            'exorcism.mirror.strike',
            'attack',
          ],
          fallback: 'attack',
        },
      ],
    },
  },
};
