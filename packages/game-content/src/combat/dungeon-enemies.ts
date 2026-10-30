import { REALM_VALUES } from '@daoyou/constants/realms';
import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import { z } from 'zod';
import raw from './data/dungeon-enemies.json' with { type: 'json' };

const positive = z.number().positive().max(1_000_000);
const scale = z.number().positive().max(3);
const baseline = z.strictObject({
  maxHp: positive,
  physicalAtk: positive,
  magicAtk: positive,
  physicalDef: positive,
  magicDef: positive,
  speed: positive,
  hit: positive,
  dodge: positive,
  referencePhysicalDef: positive,
  referenceMagicDef: positive,
});
const kind = z.strictObject({
  hp: scale,
  output: scale,
  count: z.number().int().min(1).max(4),
});

export const DungeonEnemyPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  defenseWeight: z.number().min(0).max(1),
  stages: z.strictObject({
    初期: scale,
    中期: scale,
    后期: scale,
    圆满: scale,
  }),
  tiers: z.strictObject({
    easy: scale,
    normal: scale,
    hard: scale,
    elite: scale,
    boss: scale,
  }),
  kinds: z.strictObject({
    normal: kind,
    elite: kind,
    boss: kind,
  }),
  intensity: z.strictObject({
    炼气: z.number().min(0).max(1),
    筑基: z.number().min(0).max(1),
    金丹: z.number().min(0).max(1),
    元婴: z.number().min(0).max(1),
    化神: z.number().min(0).max(1),
    炼虚: z.number().min(0).max(1),
    合体: z.number().min(0).max(1),
    大乘: z.number().min(0).max(1),
    渡劫: z.number().min(0).max(1),
  }),
  baselines: z.strictObject({
    炼气: baseline,
    筑基: baseline,
    金丹: baseline,
    元婴: baseline,
    化神: baseline,
    炼虚: baseline,
    合体: baseline,
    大乘: baseline,
    渡劫: baseline,
  }),
});

export function loadDungeonEnemyPack(data: unknown) {
  const result = DungeonEnemyPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (pack.stages.中期 !== 1) issue(['stages', '中期'], '中期是锚点，系数必须为 1');
    if (pack.tiers.normal !== 1)
      issue(['tiers', 'normal'], '普通地图是锚点，系数必须为 1');
    if (pack.kinds.normal.hp !== 1 || pack.kinds.normal.output !== 1)
      issue(['kinds', 'normal'], '普通怪是锚点，气血和输出系数必须为 1');
    for (let i = 1; i < REALM_VALUES.length; i++) {
      const previous = REALM_VALUES[i - 1]!;
      const current = REALM_VALUES[i]!;
      if (pack.intensity[current] <= pack.intensity[previous])
        issue(['intensity', current], '境界强度必须随大境界升高');
    }
    for (const realm of REALM_VALUES) {
      const row = pack.baselines[realm];
      if (row.physicalAtk <= row.referencePhysicalDef)
        issue(
          ['baselines', realm, 'physicalAtk'],
          '物攻必须高于参照物防，输出系数才有差额可乘',
        );
      if (row.magicAtk <= row.referenceMagicDef)
        issue(
          ['baselines', realm, 'magicAtk'],
          '法攻必须高于参照法防，输出系数才有差额可乘',
        );
    }
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'combat/data/dungeon-enemies.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}

export const DUNGEON_ENEMY_PACK = loadDungeonEnemyPack(raw);
