import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { beastSkillPresentation } from '@shared/combat-v6/beast-skill-presentation';
import { getLevelRealmStage } from '@shared/config/realmProgression';
import {
  BEAST_SKILL_CONTENT,
  BEAST_SKILL_FAMILIES,
} from '@shared/engine/combat-v6/beasts/content';
import { BEAST_REFINEMENT } from '@shared/engine/combat-v6/beasts/refinement-config';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import { manualEffectLines } from '@shared/engine/combat-v6/manuals/presentation';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import {
  SeedFactsSchema,
  SeedPreviewFactsSchema,
} from '@shared/items/definitions/seeds';
import { materialFactsOf } from '@shared/items/material';
import { REALM_VALUES } from '@shared/types/constants';
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
        field('产物境界', `${realm}期`),
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
      color: tierColorMap.凡品,
      tier: '',
      type: '功法玉简',
    },
    preview: (options) => ({
      header: [
        field('类型', '功法玉简'),
        field('传承境界', manual.realm),
        quantity(item, options),
      ],
      sections: [
        {
          title: '所载功法',
          entries: lines(
            [
              ...manualEffectLines(manual, 1),
              '九层：' + manualEffectLines(manual, 9).join('；'),
              manual.description,
            ].join('\n'),
          ),
        },
      ],
      description: '封存功法传承的玉简，可于悟道室参悟其中法门。',
    }),
  };
};
const advancedSkills = new Set(BEAST_SKILL_FAMILIES.map((f) => f.advanced));
export const beastBookAdapter: ItemAdapter = (item, def) => {
  const available = BEAST_SKILL_CONTENT.some(
    (skill) => skill.id === def.skillId,
  );
  const advanced = advancedSkills.has(def.skillId!);
  const tier = !available ? '已失效' : advanced ? '上品' : '普通';
  return {
    summary: {
      icon: advanced ? '📕' : '📘',
      color: tierColorMap[advanced ? '玄品' : '凡品'],
      tier,
      type: '传承灵印',
    },
    preview: (options) => ({
      header: [field('类型', `${tier} · 传承灵印`), quantity(item, options)],
      sections: [
        {
          title: '所载传承',
          entries: lines(beastSkillPresentation(def.skillId!).description),
        },
      ],
      description: advanced
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
            '重置等级，重新孕育资质、成长与天生技能，寿命恢复至原上限。',
          ),
        },
      ],
      description:
        dew.color === 'gold'
          ? '元婴及以上物种须用此露；不额外提高资质、成长或多技能概率。'
          : '涤去后天积累。',
    }),
  };
};
