import type { ExorcismLineageId } from '@daoyou/game-domain/dungeon/exorcism';
import type { ExorcismEncounterDef } from './bosses.js';

export interface ExorcismLineageDef {
  id: ExorcismLineageId;
  name: string;
  /** 首页一句话说明，不透露本局首领。 */
  trait: string;
  /** 地图节点的 scene。 */
  scenes: string[];
  /** 第一战、第二战。 */
  scout: ExorcismEncounterDef;
  ambush: ExorcismEncounterDef;
}

function pair(
  names: [string, string],
  portraits: [string, string],
  cycle: string[],
  modifiers?: ExorcismEncounterDef['enemies'][number]['modifiers'],
): ExorcismEncounterDef {
  return {
    enemies: names.map((name, index) => ({
      name,
      portrait: portraits[index],
      hpShare: 0.5,
      outputShare: 0.5,
      cycle,
      fallback: 'attack' as const,
      ...(modifiers ? { modifiers } : {}),
    })),
  };
}

function solo(
  name: string,
  portrait: string,
  cycle: string[],
  modifiers?: ExorcismEncounterDef['enemies'][number]['modifiers'],
): ExorcismEncounterDef {
  return {
    enemies: [
      {
        name,
        portrait,
        hpShare: 1,
        outputShare: 1,
        cycle,
        fallback: 'attack',
        ...(modifiers ? { modifiers } : {}),
      },
    ],
  };
}

export const EXORCISM_LINEAGES: Record<ExorcismLineageId, ExorcismLineageDef> =
  {
    grass: {
      id: 'grass',
      name: '草木祟',
      trait: '藤蔓缠身，伤势会持续发作，久战吃亏。',
      scenes: ['forest', 'steppe'],
      scout: solo('藤妖', 'yaoguai', ['attack', 'exorcism.grass.lash']),
      ambush: pair(
        ['缠藤妖', '刺藤妖'],
        ['yaoguai', 'yaoguai'],
        ['exorcism.grass.lash', 'attack'],
      ),
    },
    earth: {
      id: 'earth',
      name: '地脉祟',
      trait: '皮糙肉厚，物理难伤，一击很重。',
      scenes: ['cave', 'underground'],
      scout: solo('石傀', 'puppet', ['attack', 'exorcism.earth.slam'], {
        physicalDef: 1.3,
      }),
      ambush: pair(
        ['铜傀', '石傀'],
        ['puppet', 'puppet'],
        ['exorcism.earth.slam', 'attack'],
        { physicalDef: 1.3 },
      ),
    },
    water: {
      id: 'water',
      name: '水泽祟',
      trait: '多用术法，法防较高。',
      scenes: ['sea', 'ice'],
      scout: solo('水魅', 'spirit', ['exorcism.water.bolt', 'attack'], {
        magicDef: 1.3,
      }),
      ambush: pair(
        ['寒魅', '潮魅'],
        ['spirit', 'spirit'],
        ['exorcism.water.bolt', 'exorcism.water.bolt', 'attack'],
        { magicDef: 1.3 },
      ),
    },
    demonic: {
      id: 'demonic',
      name: '魔气祟',
      trait: '会吸走法力，要省着用。',
      scenes: ['void', 'tower_stele'],
      scout: solo('魔修', 'wanderer-m', ['exorcism.demonic.drain', 'attack']),
      ambush: pair(
        ['魔修', '魔女'],
        ['wanderer-m', 'wanderer-f'],
        ['exorcism.demonic.drain', 'attack'],
      ),
    },
    corpse: {
      id: 'corpse',
      name: '阴尸祟',
      trait: '皮糙肉厚，腐气让治疗打折，爪击能破甲。',
      scenes: ['tomb', 'sect_ruin'],
      scout: solo('行尸', 'servant-m', ['attack', 'exorcism.corpse.claw'], {
        hp: 0.8,
        physicalDef: 1.4,
        magicDef: 1.4,
      }),
      ambush: pair(
        ['披甲行尸', '幽火尸卒'],
        ['servant-m', 'servant-f'],
        ['exorcism.rot.claw', 'exorcism.corpse.claw'],
        { hp: 1.2, physicalDef: 1.2, magicDef: 1.2 },
      ),
    },
  };

export function exorcismLineageForScene(
  scene: string | undefined,
): ExorcismLineageId {
  const found = Object.values(EXORCISM_LINEAGES).find((row) =>
    scene ? row.scenes.includes(scene) : false,
  );
  return found?.id ?? 'demonic';
}
