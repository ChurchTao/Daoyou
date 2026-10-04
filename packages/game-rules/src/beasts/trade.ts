import {
  createBeastTradeSchemas,
  type BeastTransfer,
  type BeastLineup,
  type SummonedBeast,
} from '@daoyou/game-domain/beasts';
export const { BeastTransferSchema, BeastTradePreviewSchema } = createBeastTradeSchemas(BeastSchema);





import { BeastSchema } from './schema.js';


export function beastAuctionBlockReason(
  beast: SummonedBeast,
  owner: string,
  revision: number,
  lineup: BeastLineup,
) {
  if (beast.ownerCultivatorId !== owner) return '只能寄售自己的灵兽';
  if (beast.revision !== revision) return '灵兽已有变化，请重新查看';
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
