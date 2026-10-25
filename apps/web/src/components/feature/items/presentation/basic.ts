import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { beastSkillPresentation } from '@daoyou/game-rules/beasts/presentation';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import {
  BEAST_SKILL_CONTENT,
  BEAST_SUPERIOR_BOOK_SKILL_IDS,
  BEAST_REFINEMENT,
} from '@daoyou/game-content/beasts';
import { BEAST_LURE, BEAST_REJUVENATION } from '@daoyou/game-content/items/beasts';
import {
  BEAST_LURE_RATE_MULTIPLIER,
  BEAST_LURE_SEARCHES,
} from '@daoyou/game-rules/combat/wild';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { manualEffectLines } from '@daoyou/game-rules/manuals/presentation';
import { isAdvancedManual } from '@daoyou/game-rules/manuals/projection';
import { EQUIPMENT_SLOT_NAMES } from '@daoyou/game-domain/equipment';
import {
  MATERIAL_TYPE_NAMES,
  SeedFactsSchema,
  SeedPreviewFactsSchema,
  materialFactsOf,
} from '@daoyou/game-domain/inventory';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { field, lines, quantity } from './helpers';
import type { ItemAdapter } from './types';

export const blueprintAdapter: ItemAdapter = (item, def) => {
  const realm = getLevelRealmStage(def.level!).realm;
  return {
    summary: {
      icon: '📜',
      color: tierColorMap[realm],
      tier: realm,
      type: '道装图纸',
    },
    preview: (options) => ({
      header: [
        field('类型', '道装图纸'),
        quantity(item, options),
      ],
      sections: [],
      description: `记载${EQUIPMENT_SLOT_NAMES[def.slot!]}铸造之法的图纸，铸造时消耗1张。`,
    }),
  };
};
export const materialAdapter: ItemAdapter = (item) => {
  const facts = materialFactsOf(item.instanceData);
  const type = MATERIAL_TYPE_NAMES[facts.type];
  return {
    summary: {
      icon: {
        herb: '🌿',
        ore: '🪨',
        tcdb: '💎',
        aux: '🧵',
        monster: '🦴',
        gongfa_manual: '📚',
        skill_manual: '📖',
      }[facts.type],
      color: tierColorMap[facts.rank],
      tier: facts.rank,
      type,
    },
    preview: (options) => ({
      header: [
        field('类型', `${facts.rank} · ${type}`),
        quantity(item, options),
      ],
      sections: facts.element
        ? [
            {
              title: '道具资料',
              entries: [{ kind: 'line', label: '五行', value: facts.element }],
            },
          ]
        : [],
      description: facts.description || '可用于对应炼造玩法的灵材。',
    }),
  };
};
export const seedAdapter: ItemAdapter = (item) => {
  const fullFacts = SeedFactsSchema.safeParse(item.instanceData);
  const plant = fullFacts.success
    ? fullFacts.data.seedSpec.plant
    : SeedPreviewFactsSchema.parse(item.instanceData).seedPreview;
  return {
    summary: {
      icon: '🌱',
      color: tierColorMap[plant.quality],
      tier: plant.quality,
      type: '灵种',
    },
    preview: (options) => ({
      header: [
        field('类型', `${plant.quality} · 灵种`),
        field('功能', '灵田培育'),
        field('要求', `${plant.minRealm}及以上`),
        quantity(item, options),
      ],
      sections: [
        {
          title: '道具资料',
          entries: [{ kind: 'line', label: '五行', value: plant.element }],
        },
        ...(plant.clueTexts.length
          ? [{ title: '培育线索', entries: lines(plant.clueTexts.join('\n')) }]
          : []),
      ],
      description: plant.seedDescription,
    }),
  };
};
export const manualAdapter: ItemAdapter = (item, def) => {
  const manual = CHARACTER_MANUALS_V1.find((m) => m.id === def.manualId)!;
  return {
    summary: {
      icon: '📗',
      color: tierColorMap[manual.realm],
      tier: '',
      type: '功法玉简',
    },
    preview: (options) => ({
      header: [
        field('类型', '功法玉简'),
        field('功法类别', isAdvancedManual(manual) ? '高阶功法' : '基础功法'),
        field('要求', `${manual.realm}及以上`),
        quantity(item, options),
      ],
      sections: [
        {
          title: '所载功法',
          entries: lines(
            [
              ...manualEffectLines(manual, 1),
              manual.description,
            ].join('\n'),
          ),
        },
      ],
      description: '封存功法传承的玉简，可于悟道室参悟其中法门。',
    }),
  };
};
export const beastBookAdapter: ItemAdapter = (item, def) => {
  const available = BEAST_SKILL_CONTENT.some(
    (skill) => skill.id === def.skillId,
  );
  const superior = BEAST_SUPERIOR_BOOK_SKILL_IDS.has(def.skillId!);
  const tier = !available ? '已失效' : superior ? '上品' : '普通';
  const skill = beastSkillPresentation(def.skillId!);
  return {
    summary: {
      icon: superior ? '📕' : '📘',
      color: tierColorMap[superior ? '神品' : '地品'],
      tier,
      type: '传承灵印',
    },
    preview: (options) => ({
      header: [field('类型', `${tier} · 传承灵印`), quantity(item, options)],
      sections: [
        {
          title: '所载传承',
          entries: [
            ...lines(skill.summary).map((line) => ({ ...line, tone: 'muted' as const })),
            ...(skill.details
              ? [{
                  kind: 'disclosure' as const,
                  title: '具体效果',
                  tone: 'positive' as const,
                  rows: lines(skill.details),
                }]
              : []),
          ],
        },
      ],
      description: superior
        ? '封存着更为精深的妖灵传承，可助灵兽领悟其中的本领。'
        : '封存着妖灵传承的灵念，可助灵兽领悟其中的本领。',
    }),
  };
};
export const refinementAdapter: ItemAdapter = (item, def) => {
  const dew = BEAST_REFINEMENT.items.find((d) => d.id === def.id)!;
  const color = dew.color === 'jade' ? 'text-teal' : 'text-tier-tian';
  return {
    summary: {
      icon: '💧',
      color,
      tier: '',
      type: '归元灵露',
    },
    preview: (options) => ({
      header: [
        field('功能', '灵兽洗炼'),
        field(
          '要求',
          dew.allowedRealms.length === REALM_VALUES.length
            ? '不限境界'
            : `不高于${dew.allowedRealms[dew.allowedRealms.length - 1]}`,
        ),
        quantity(item, options),
      ],
      sections: [
        {
          title: '洗炼效果',
          entries: lines(
            '重置等级，重新孕育资质、成长与技能，寿命恢复至原上限。',
          ),
        },
      ],
      description:
        dew.color === 'gold'
          ? '炼虚及以上灵兽须用此露。洗炼所得与普通归元灵露相同。'
          : '涤去后天积累。',
    }),
  };
};
export const rejuvenationAdapter: ItemAdapter = (item) => ({
  summary: {
    icon: '🍑',
    color: tierColorMap['天品'],
    tier: '',
    type: '灵果',
  },
  preview: (options) => ({
    header: [
      field('类型', '灵果'),
      field('功能', '灵兽洗点'),
      quantity(item, options),
    ],
    sections: [
      {
        title: '洗点效果',
        entries: lines(
          '已分配属性点退回待分配，等级与修为不变。捕获时已有等级的野生，原有点数亏损保留。',
        ),
      },
    ],
    description: BEAST_REJUVENATION.description,
  }),
});
export const beastLureAdapter: ItemAdapter = (item) => ({
  summary: {
    icon: '🪔',
    color: tierColorMap['仙品'],
    tier: '',
    type: '引妖香',
  },
  preview: (options) => ({
    header: [field('功能', '寻觅提升'), quantity(item, options)],
    sections: [
      {
        title: '效果',
        tone: 'positive',
        entries: lines(
          `接下来${BEAST_LURE_SEARCHES}次寻觅，稀有与变异概率各变为${BEAST_LURE_RATE_MULTIPLIER}倍。`,
        ),
      },
      {
        title: '限制',
        tone: 'warning',
        entries: lines(
          `没有稀有异兽的地区只提高变异。余效未尽时再次点燃，次数回到${BEAST_LURE_SEARCHES}。`,
        ),
      },
    ],
    description: BEAST_LURE.description,
  }),
});
