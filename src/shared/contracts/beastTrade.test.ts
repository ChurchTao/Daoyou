import { describe, expect, it } from 'vitest';
import {
  BEAST_STARTER_SPECIES,
  generateStarterBeast,
} from '../engine/combat-v6/beasts';
import { generateCapturedBeast } from '../engine/combat-v6/beasts/generator';
import { MailAttachmentSchema } from '../lib/itemLibrary';
import { AuctionBeastListSchema, AuctionSnapshotSchema } from './auction';
import {
  BeastTransferSchema,
  beastAuctionBlockReason,
  beastTradePreview,
  planBeastMailClaims,
  receiveTradedBeast,
} from './beastTrade';

const owner = '00000000-0000-4000-8000-000000000001';
const buyer = '00000000-0000-4000-8000-000000000002';
const id = '00000000-0000-4000-8000-000000000003';
const species = BEAST_STARTER_SPECIES[0].id;
const lineup = { carriedBeastIds: [], revision: 0 };
const starter = generateStarterBeast(id, owner, species, 7);

describe('灵兽交易资产规则', () => {
  it('允许初始、捕获、变异和零寿命个体，不改变培养事实', () => {
    for (const beast of [
      starter,
      generateCapturedBeast(id, owner, species, 10, 13),
      generateCapturedBeast(id, owner, species, 10, 13, true),
      { ...starter, currentLifespan: 0 },
    ]) {
      expect(
        beastAuctionBlockReason(beast, owner, beast.revision, lineup),
      ).toBeNull();
      const { id: beastId, ownerCultivatorId: _owner, ...individual } = beast;
      void _owner;
      const transfer = BeastTransferSchema.parse({
        id: beastId,
        createdAt: '2026-09-19T00:00:00.000Z',
        individual: { ...individual, revision: beast.revision + 1 },
      });
      const snapshot = AuctionSnapshotSchema.parse({
        version: 'beast_v1',
        beast: transfer,
      });
      expect(snapshot.version).toBe('beast_v1');
      const received = receiveTradedBeast(transfer, buyer);
      expect(received).toEqual({
        ...beast,
        ownerCultivatorId: buyer,
        revision: beast.revision + 2,
      });
      expect(
        beastAuctionBlockReason(
          receiveTradedBeast(transfer, owner),
          owner,
          beast.revision,
          lineup,
        ),
      ).toContain('变化');
    }
  });
  it('拒绝归属、版本、编组和个体事实冲突', () => {
    expect(beastAuctionBlockReason(starter, buyer, 0, lineup)).toContain(
      '自己',
    );
    expect(beastAuctionBlockReason(starter, owner, 1, lineup)).toContain(
      '变化',
    );
    expect(
      beastAuctionBlockReason(starter, owner, 0, {
        ...lineup,
        carriedBeastIds: [id],
      }),
    ).toContain('携带');
    expect(
      beastAuctionBlockReason(starter, owner, 0, {
        ...lineup,
        carriedBeastIds: [id],
        leadBeastId: id,
      }),
    ).toContain('首发');
    expect(
      beastAuctionBlockReason(
        { ...starter, currentLifespan: starter.maxLifespan + 1 },
        owner,
        0,
        lineup,
      ),
    ).toBeTruthy();
  });
  it('公共预览保留买家决策事实，隐藏身份和生成内部信息', () => {
    const preview = beastTradePreview(starter);
    expect(preview.skills).toEqual(starter.skills);
    expect(preview.aptitudes).toEqual(starter.aptitudes);
    for (const key of [
      'id',
      'ownerCultivatorId',
      'revision',
      'generationSeed',
      'generationVersion',
      'generationContentRevision',
    ])
      expect(preview).not.toHaveProperty(key);
  });
  it('快照拒绝重复归属、损坏技能及不可领取版本，附件只能一只', () => {
    const { id: beastId, ownerCultivatorId: _owner, ...individual } = starter;
    void _owner;
    const transfer = {
      id: beastId,
      createdAt: '2026-09-19T00:00:00.000Z',
      individual,
    };
    for (const patch of [
      { ownerCultivatorId: owner },
      { skills: ['unknown'] },
      { revision: 100000 },
    ])
      expect(
        BeastTransferSchema.safeParse({
          ...transfer,
          individual: { ...individual, ...patch },
        }).success,
      ).toBe(false);
    expect(
      MailAttachmentSchema.safeParse({
        type: 'beast_v1',
        name: starter.name,
        quantity: 1,
        beast: transfer,
      }).success,
    ).toBe(true);
    expect(
      MailAttachmentSchema.safeParse({
        type: 'beast_v1',
        name: starter.name,
        quantity: 2,
        beast: transfer,
      }).success,
    ).toBe(false);
  });
  it('上架只接受引用且公私对象不能混用', () => {
    const request = {
      requestId: id,
      beastId: id,
      expectedRevision: 0,
      price: 100,
      visibility: 'public',
    };
    expect(AuctionBeastListSchema.safeParse(request).success).toBe(true);
    for (const patch of [
      { beast: starter },
      { quantity: 1 },
      { price: 0 },
      { price: 10000000 },
      { visibility: 'private' },
      { targetCultivatorId: buyer },
    ])
      expect(
        AuctionBeastListSchema.safeParse({ ...request, ...patch }).success,
      ).toBe(false);
    expect(
      AuctionBeastListSchema.safeParse({
        ...request,
        visibility: 'private',
        targetCultivatorId: buyer,
      }).success,
    ).toBe(true);
  });
});

describe('灵兽邮件整封领取规划', () => {
  const mails = [
    { id: 'b', createdAt: '2026-09-19', beastCount: 1 },
    { id: 'a', createdAt: '2026-09-19', beastCount: 2 },
    { id: 'c', createdAt: '2026-09-20', beastCount: 0 },
  ];
  it('容量不足跳过整封，继续领取后来能放下的邮件与普通邮件', () => {
    const result = planBeastMailClaims(mails, 1, false);
    expect(result.claimable.map((m) => m.id)).toEqual(['b', 'c']);
    expect(result.skipped).toEqual([{ id: 'a', reason: 'capacity' }]);
    expect(
      planBeastMailClaims(mails, 0, false).claimable.map((m) => m.id),
    ).toEqual(['c']);
    expect(
      planBeastMailClaims(mails, 3, false).claimable.map((m) => m.id),
    ).toEqual(['a', 'b', 'c']);
  });
  it('占用时保留全部灵兽邮件，空输入与全部跳过可恢复', () => {
    expect(planBeastMailClaims(mails, 24, true).skipped).toEqual([
      { id: 'a', reason: 'occupied' },
      { id: 'b', reason: 'occupied' },
    ]);
    expect(planBeastMailClaims(mails.slice(0, 2), 0, false).claimable).toEqual(
      [],
    );
    expect(planBeastMailClaims([], 0, false)).toEqual({
      claimable: [],
      skipped: [],
    });
  });
});
