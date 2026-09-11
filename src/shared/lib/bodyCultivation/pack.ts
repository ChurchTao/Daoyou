import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import type { BodyCultivationRealm, BodyCultivationTrackKey } from '@shared/types/condition';
import raw from './data/body-cultivation.json';

export const BODY_CULTIVATION_TRACK_KEYS = ['skin', 'sinew_bone', 'organs', 'qi_blood', 'primordial_spirit'] as const satisfies BodyCultivationTrackKey[];
const realmKeys = ['mortal_body', 'bronze_skin', 'iron_bone', 'jade_marrow', 'golden_body', 'dharma_body', 'dao_body'] as const satisfies BodyCultivationRealm[];
const trainingAttributes = ['attackCultivate', 'defenseCultivate', 'spellCultivate', 'resistSpellCultivate'] as const;
const text = z.string().min(1).max(100);
const integer = z.number().int().min(0).max(1000000);
const training = z.strictObject({ kind: z.literal('training'), attribute: z.enum(trainingAttributes), perLevel: z.number().min(0).max(100) });
const life = z.strictObject({ kind: z.literal('life'), hpRatioPerLevel: z.number().min(0).max(1), healLevelsPerPoint: integer.min(1) });
const labels = { name: text, layerName: text, shortDesc: text };
export const BodyCultivationPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: integer.min(1),
  tracks: z.strictObject({
    skin: z.strictObject({ ...labels, benefit: training }),
    sinew_bone: z.strictObject({ ...labels, benefit: training }),
    organs: z.strictObject({ ...labels, benefit: training }),
    qi_blood: z.strictObject({ ...labels, benefit: life }),
    primordial_spirit: z.strictObject({ ...labels, benefit: training }),
  }),
  realms: z.array(z.strictObject({
    realm: z.enum(realmKeys), label: text,
    minCultivationRealm: z.enum(Object.keys(REALM_ORDER) as [RealmType, ...RealmType[]]),
    totalLevel: integer, softTrackCap: integer.min(1).max(1000),
  })).length(realmKeys.length),
  progress: z.strictObject({ base: integer.min(1), perLevel: integer, milestoneInterval: integer.min(1).max(1000) }),
});
export function loadBodyCultivationPack(data: unknown) {
  const result = BodyCultivationPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const attrs = BODY_CULTIVATION_TRACK_KEYS.flatMap(key => pack.tracks[key].benefit.kind === 'training' ? [(pack.tracks[key].benefit as z.infer<typeof training>).attribute] : []);
    if (new Set(attrs).size !== trainingAttributes.length) issue(['tracks'], '四种修炼属性必须各映射一次');
    pack.realms.forEach((realm, i) => {
      if (realm.realm !== realmKeys[i]) issue(['realms', i, realm.realm], '肉身位阶顺序必须完整且与已有成长顺序一致');
      const previous = pack.realms[i - 1];
      if (!previous) {
        if (realm.totalLevel !== 0) issue(['realms', i, 'totalLevel'], '初始位阶总等级门槛必须为零');
      } else {
        if (realm.softTrackCap <= previous.softTrackCap || realm.totalLevel <= previous.totalLevel || REALM_ORDER[realm.minCultivationRealm] < REALM_ORDER[previous.minCultivationRealm]) issue(['realms', i, realm.realm], '位阶门槛和上限必须递增，修为境界不能倒退');
        if (realm.totalLevel > previous.softTrackCap * BODY_CULTIVATION_TRACK_KEYS.length) issue(['realms', i, 'totalLevel'], '前一位阶五轨上限无法达到此门槛');
      }
    });
    const cap = pack.realms[pack.realms.length - 1].softTrackCap;
    if (!Number.isSafeInteger(pack.progress.base + pack.progress.perLevel * cap)) issue(['progress'], '最高等级进度需求溢出');
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('bodyCultivation/data/body-cultivation.json', data, result.error.issues));
  return result.data;
}
export const BODY_CULTIVATION_PACK = loadBodyCultivationPack(raw);

export function bodyTrainingLevelCap(pack = BODY_CULTIVATION_PACK): number {
  return pack.realms[pack.realms.length - 1].softTrackCap;
}

export function bodyCultivationThreshold(level: number, pack = BODY_CULTIVATION_PACK): number {
  return pack.progress.base + pack.progress.perLevel * Math.max(0, Math.floor(level));
}
