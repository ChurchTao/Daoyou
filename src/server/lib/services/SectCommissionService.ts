import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import * as sectRepository from '@server/lib/repositories/sectRepository';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import { SectError } from './SectService';

export type SectCommissionType = 'spar' | 'dungeon' | 'ranking';

export function getShanghaiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export class SectCommissionService {
  static async getToday(cultivatorId: string, q: DbExecutor | DbTransaction) {
    const membership = await sectRepository.findMembership(cultivatorId, q);
    const dateKey = getShanghaiDateKey();
    if (!membership) return { dateKey };
    const row = await sectRepository.findCommission(membership.id, dateKey, q);
    return { dateKey, completionType: row?.completionType, completedAt: row?.completedAt.toISOString(), claimedAt: row?.claimedAt?.toISOString() };
  }

  static async recordEvent(cultivatorId: string, completionType: SectCommissionType, tx: DbTransaction): Promise<boolean> {
    const membership = await sectRepository.findMembership(cultivatorId, tx);
    if (!membership || membership.status !== 'active') return false;
    return sectRepository.insertCommissionCompletion({ membershipId: membership.id, dateKey: getShanghaiDateKey(), completionType }, tx);
  }

  static async claim(cultivatorId: string, realm: RealmType, tx: DbTransaction) {
    const membership = await sectRepository.findMembership(cultivatorId, tx);
    if (!membership || membership.status !== 'active') throw new SectError('SECT_TRIAL_REQUIRED', '尚未拜入宗门');
    const dateKey = getShanghaiDateKey();
    const reward = 30 + 10 * REALM_ORDER[realm];
    if (!(await sectRepository.claimCommission(membership.id, dateKey, reward, tx))) throw new SectError('SECT_COMMISSION_ALREADY_CLAIMED', '今日委托未完成或奖励已领取');
    return {
      reward,
      dateKey,
      sect: await sectRepository.loadCultivatorSectState(cultivatorId, tx),
    };
  }
}
