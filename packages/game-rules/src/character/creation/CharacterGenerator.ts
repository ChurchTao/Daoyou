import { getRealmStageUnallocatedAttributeBudget } from '../../progression/attributes.js';
import type { Cultivator } from '@daoyou/game-domain/character';
import {
  normalizeCultivatorAIData,
  type CultivatorAIRawData,
} from '@daoyou/game-domain/character/generation';
import { generateAttributes, generateSpiritualRoots } from './utils.js';

export function buildGeneratedCharacter(
  raw: CultivatorAIRawData,
  userInput: string,
  rng: () => number,
): { cultivator: Cultivator; balanceNotes: string } {
  const data = normalizeCultivatorAIData(raw);

  // 2. 数值化生成
  const attributes = generateAttributes();
  const spiritual_roots = generateSpiritualRoots(
    data.aptitude_score,
    data.element_preferences,
    rng,
  );

  // 4. 其他基础数值
  const age = 14 + Math.floor(rng() * 6); // 14-20岁
  // 寿元：炼气期基础100，分数高加成
  const lifespan =
    80 + Math.floor(rng() * 20) + (data.aptitude_score > 80 ? 20 : 0);

  // 构造完整的 Cultivator 对象
  const cultivator: Cultivator = {
    id: '', // Placeholder
    name: data.name,
    gender: data.gender,
    origin: data.origin,
    personality: data.personality,
    background: data.background,
    playerRace: 'human',
    raceNarrative: data.race_narrative,

    realm: '炼气',
    realm_stage: '初期',
    age,
    lifespan,

    attributes,
    unallocated_attribute_points: getRealmStageUnallocatedAttributeBudget(
      '炼气',
      '初期',
    ),
    spiritual_roots,
    status: 'active',
    spirit_stones: 0,
    pre_heaven_fates: [], // 后续流程生成
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    prompt: userInput,
    balance_notes: data.balance_notes,
  };

  return {
    cultivator,
    balanceNotes: data.balance_notes,
  };
}
