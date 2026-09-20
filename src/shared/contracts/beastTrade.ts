import { z } from 'zod';
import {
  BeastSchema,
  type BeastLineup,
  type SummonedBeast,
} from '../engine/combat-v6/beasts/schema';

// Ownership is supplied by the listing/mail container, never by its payload.
const transferOwner = '00000000-0000-4000-8000-000000000000';
const {
  id: _id,
  ownerCultivatorId: _owner,
  ...individualShape
} = BeastSchema.shape;
void _id;
void _owner;
export const BeastTransferSchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    individual: z.strictObject(individualShape),
  })
  .superRefine((value, ctx) => {
    const parsed = BeastSchema.safeParse({
      ...value.individual,
      id: value.id,
      ownerCultivatorId: transferOwner,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        ctx.addIssue({ code: 'custom', message: issue.message });
    if (value.individual.revision >= 100000)
      ctx.addIssue({ code: 'custom', message: '灵兽版本已达上限' });
  });
export type BeastTransfer = z.infer<typeof BeastTransferSchema>;
export type BeastTradePreview = Pick<
  SummonedBeast,
  | 'name'
  | 'speciesId'
  | 'isMutant'
  | 'originKind'
  | 'initialLevel'
  | 'level'
  | 'exp'
  | 'growth'
  | 'aptitudes'
  | 'allocatedAttributes'
  | 'unallocatedPoints'
  | 'skillSlotCapacity'
  | 'skills'
  | 'currentLifespan'
  | 'maxLifespan'
>;

export function beastTradePreview(beast: BeastTradePreview): BeastTradePreview {
  return {
    name: beast.name,
    speciesId: beast.speciesId,
    isMutant: beast.isMutant,
    originKind: beast.originKind,
    initialLevel: beast.initialLevel,
    level: beast.level,
    exp: beast.exp,
    growth: beast.growth,
    aptitudes: beast.aptitudes,
    allocatedAttributes: beast.allocatedAttributes,
    unallocatedPoints: beast.unallocatedPoints,
    skillSlotCapacity: beast.skillSlotCapacity,
    skills: beast.skills,
    currentLifespan: beast.currentLifespan,
    maxLifespan: beast.maxLifespan,
  };
}

export function beastAuctionBlockReason(
  beast: SummonedBeast,
  owner: string,
  revision: number,
  lineup: BeastLineup,
) {
  if (beast.ownerCultivatorId !== owner) return '只能寄售自己的灵兽';
  if (beast.revision !== revision) return '灵兽已变化，请刷新后重试';
  if (lineup.leadBeastId === beast.id) return '请先取消灵兽首发';
  if (lineup.carriedBeastIds.includes(beast.id))
    return '请先将灵兽移出携带编组';
  if (!BeastSchema.safeParse(beast).success || beast.revision >= 99999)
    return '灵兽个体事实或版本无效';
  return null;
}

export function receiveTradedBeast(
  transfer: BeastTransfer,
  ownerCultivatorId: string,
): SummonedBeast {
  const valid = BeastTransferSchema.parse(transfer);
  return BeastSchema.parse({
    ...valid.individual,
    id: valid.id,
    ownerCultivatorId,
    revision: valid.individual.revision + 1,
  });
}

/** Whole-mail capacity planning; callers validate attachments before planning. */
export function planBeastMailClaims<
  T extends { id: string; createdAt: Date | string; beastCount: number },
>(mails: T[], available: number, occupied: boolean) {
  const claimable: T[] = [];
  const skipped: { id: string; reason: 'capacity' | 'occupied' }[] = [];
  let remaining = Math.max(0, available);
  for (const mail of [...mails].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      a.id.localeCompare(b.id),
  )) {
    if (mail.beastCount && (occupied || mail.beastCount > remaining)) {
      skipped.push({ id: mail.id, reason: occupied ? 'occupied' : 'capacity' });
    } else {
      remaining -= mail.beastCount;
      claimable.push(mail);
    }
  }
  return { claimable, skipped };
}
