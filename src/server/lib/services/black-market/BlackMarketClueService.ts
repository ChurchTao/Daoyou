import { blackMarketUnit } from '@shared/lib/blackMarketRules';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import type {
  BlackMarketInspectionKind,
  BlackMarketNpcId,
} from '@shared/types/blackMarket';
import {
  QUALITY_ORDER,
  QUALITY_VALUES,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import type { BlackMarketSafeClue } from './types';

const MASKS: Record<MaterialType, Array<[string, string]>> = {
  herb: [
    ['封泥药囊', '封泥已经龟裂，淡得几乎闻不出的药香仍未散尽。'],
    ['枯萎灵草束', '叶脉晦暗，偶尔有一线灵光从根须间游过。'],
  ],
  ore: [
    ['裂纹矿胚', '石皮粗粝斑驳，敲击时传来沉闷回音。'],
    ['裹泥金属块', '厚重泥壳遮住了内里，边角偶有冷芒一闪。'],
  ],
  monster: [
    ['缠布兽骨', '旧布下妖气驳杂，骨节的形制已经难辨。'],
    ['斑驳鳞片包', '鳞面黯淡失光，边缘却依旧锋利。'],
  ],
  tcdb: [
    ['蒙尘古盒', '盒身没有铭文，神识靠近时却隐有回鸣。'],
    ['无名灵物残块', '外表毫不起眼，重量却与体积并不相称。'],
  ],
  aux: [
    ['封蜡辅料罐', '蜡封年久开裂，罐内气息忽强忽弱。'],
    ['浑浊灵液瓶', '瓶中灵液层层分离，效用难以一眼分明。'],
  ],
  gongfa_manual: [
    ['虫蛀旧经卷', '纸页泛黄，断续字迹间似乎藏着周天图谱。'],
    ['封角残破典籍', '书脊多处开裂，翻动时仍有灵识微震。'],
  ],
  skill_manual: [
    ['残页秘术抄本', '笔意凌乱，几处完整法门被污迹遮住。'],
    ['无名术法残卷', '纸面残缺，未散的术意却偶尔刺得人指尖发麻。'],
  ],
};

function qualityBand(quality: Quality): string {
  const order = QUALITY_ORDER[quality];
  const min = QUALITY_VALUES[Math.max(0, order - 1)];
  const max = QUALITY_VALUES[Math.min(QUALITY_VALUES.length - 1, order + 1)];
  return min === max ? min : `${min}至${max}`;
}

function saleReason(npcId: BlackMarketNpcId, seed: string): string {
  const variants: Record<BlackMarketNpcId, string[]> = {
    'smiling-keeper': [
      '卖家并不急于出手，话里更像是在试探买家的见识',
      '卖家自称替故人清货，但明显隐去了货物转手次数',
    ],
    'silent-elder': [
      '卖家认为此物留在手里无用，却并不愿贱卖',
      '卖家只说清理旧藏，对来路避而不谈',
    ],
    'urgent-cultivator': [
      '卖家确实急需灵石，但急迫背后似乎另有麻烦',
      '卖家准备立刻离城，宁愿少赚也不想久留',
    ],
  };
  const pool = variants[npcId];
  return pool[Math.floor(blackMarketUnit(seed, 'sale-reason') * pool.length)];
}

export function buildBlackMarketMask(
  item: Material,
  seed: string,
): { disguisedName: string; disguisedDescription: string } {
  const pool = MASKS[item.type];
  const selected =
    pool[Math.floor(blackMarketUnit(seed, 'mask') * pool.length)];
  return {
    disguisedName: selected[0],
    disguisedDescription: selected[1],
  };
}

export function buildBlackMarketSafeClues(input: {
  item: Material;
  npcId: BlackMarketNpcId;
  seed: string;
  regionTags: readonly string[];
}): BlackMarketSafeClue[] {
  const typeInfo = getMaterialTypeInfo(input.item.type);
  const elementFact = input.item.element
    ? `灵气明确偏向${input.item.element}，强度约在${qualityBand(input.item.rank)}`
    : `灵气没有明显五行偏向，强度约在${qualityBand(input.item.rank)}`;
  const region = input.regionTags.filter(Boolean).slice(0, 2).join('、');

  return [
    {
      id: 'clue-appearance',
      kind: 'appearance',
      text: '',
      fact: `器物形制与${typeInfo.label}一致，外层伪装未改变核心材质`,
      fallbackText: `细看之下，这东西的形制仍更接近${typeInfo.label}，外头那层伪装做得并不彻底。`,
    },
    {
      id: 'clue-aura',
      kind: 'aura',
      text: '',
      fact: elementFact,
      fallbackText: input.item.element
        ? `气息里有一股清晰的${input.item.element}意，强弱大约落在${qualityBand(input.item.rank)}之间。`
        : `气息不显五行，强弱大约落在${qualityBand(input.item.rank)}之间。`,
    },
    {
      id: 'clue-damage',
      kind: 'damage',
      text: '',
      fact: '可见损伤主要停留在外壳和伪装层，核心灵性仍然连贯',
      fallbackText: '裂痕看着吓人，却大多停在表层；真正连贯的灵性还在里面。',
    },
    {
      id: 'clue-origin',
      kind: 'origin',
      text: '',
      fact: region
        ? `残留气息与${region}一带的流通货物相近，具体出处无法确认`
        : '残留气息只能证明经过多次转手，具体出处无法确认',
      fallbackText: region
        ? `上面的气息像是从${region}一带辗转过来，至于最初出自哪里，没人说得准。`
        : '这东西经手不止一次，最初从哪里流出来的，已经说不准了。',
    },
    {
      id: 'clue-sale-reason',
      kind: 'sale_reason',
      text: '',
      fact: saleReason(input.npcId, input.seed),
      fallbackText: saleReason(input.npcId, input.seed),
    },
  ];
}

export function inferQuestionClueKind(
  question: string,
): BlackMarketInspectionKind | null {
  if (/灵气|属性|五行|品阶|品质|神识|感知/.test(question)) return 'aura';
  if (/坏|裂|破|损|完整|真假|伪/.test(question)) return 'damage';
  if (/来历|哪来|出处|地方|区域|遗迹/.test(question)) return 'origin';
  if (/为何|为什么|急|出售|卖掉|脱手/.test(question)) return 'sale_reason';
  if (/外观|形状|材质|年代|看看|观察/.test(question)) return 'appearance';
  return null;
}
