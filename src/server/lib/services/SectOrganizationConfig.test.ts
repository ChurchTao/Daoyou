import { describe, expect, it } from 'vitest';
import {
  getSectBountyMode,
  getSectDateKey,
  getSectDonationDemands,
  getSectWeekKey,
} from './SectOrganizationConfig';

describe('宗门日周配置', () => {
  it('使用 Asia/Shanghai 生成日期与周一键', () => {
    expect(getSectDateKey(new Date('2026-07-19T16:30:00.000Z'))).toBe('2026-07-20');
    expect(getSectWeekKey(new Date('2026-07-19T16:30:00.000Z'))).toBe('2026-07-20');
    expect(getSectWeekKey(new Date('2026-07-26T15:59:59.000Z'))).toBe('2026-07-20');
  });

  it('同一周悬赏模式稳定，相邻周发生轮换', () => {
    expect(getSectBountyMode('2026-07-20')).toBe(getSectBountyMode('2026-07-20'));
    expect(getSectBountyMode('2026-07-20')).not.toBe(getSectBountyMode('2026-07-27'));
  });

  it('同一日期需求确定且法宝与丹药按日轮换', () => {
    expect(getSectDonationDemands('lingxiao', '2026-07-20')).toEqual(
      getSectDonationDemands('lingxiao', '2026-07-20'),
    );
    expect(getSectDonationDemands('lingxiao', '2026-07-20')[2]?.kind).not.toBe(
      getSectDonationDemands('lingxiao', '2026-07-21')[2]?.kind,
    );
  });
});
