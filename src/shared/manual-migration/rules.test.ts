import { describe, expect, it } from 'vitest';
import {
  ExchangeManualSchema,
  ManualMigrationConfigSchema,
} from '../contracts/manualMigration';
import { QUALITY_VALUES } from '../types/constants';
import {
  buildManualMigrationPolicy,
  drawLegacyManual,
  MANUAL_MIGRATION_CONFIG,
  manualMigrationPlan,
  validateManualSelection,
} from './rules';
const policy = buildManualMigrationPolicy({
  s2: 1000,
  s3: 2000,
  distribution: 'existing',
});
const source = { id: 'x', name: '旧功法', quality: '神品', score: 1000 };
describe('旧功法补偿', () => {
  it('采用已确认的 3000 / 3200 评分线与参悟权重', () => {
    expect(MANUAL_MIGRATION_CONFIG).toEqual({
      s2: 3000,
      s3: 3200,
      distribution: 'existing',
    });
    const confirmed = buildManualMigrationPolicy(MANUAL_MIGRATION_CONFIG);
    expect(
      [2999, 3000, 3199, 3200].map(
        (score) => manualMigrationPlan({ ...source, score }, confirmed).choices,
      ),
    ).toEqual([0, 1, 1, 2]);
  });
  it('固定八品质次数与天品范围，不沿用旧建议', () => {
    expect(QUALITY_VALUES.map((q) => policy.rules[q].count)).toEqual([
      1, 2, 3, 3, 3, 4, 4, 6,
    ]);
    expect(policy.rules.天品.realms).toEqual(['金丹', '元婴']);
    expect(policy.rules.天品.weights[0]).toBeCloseTo(5 / 6);
  });
  it('分数门槛包含边界，最高档不叠加', () => {
    expect(
      [999, 1000, 1999, 2000, 9000].map(
        (score) => manualMigrationPlan({ ...source, score }, policy).choices,
      ),
    ).toEqual([0, 1, 1, 2, 2]);
  });
  it('异常来源与错误门槛不能降档兑换', () => {
    expect(() =>
      manualMigrationPlan({ ...source, quality: null }, policy),
    ).toThrow();
    expect(() =>
      manualMigrationPlan({ ...source, score: 0 }, policy),
    ).toThrow();
    expect(
      ManualMigrationConfigSchema.safeParse({
        s2: 2000,
        s3: 1000,
        distribution: 'existing',
      }).success,
    ).toBe(false);
  });
  it('所有品质每次必得、产出限于指定境界，重复结果合并', () => {
    for (const quality of QUALITY_VALUES)
      for (const value of [0, 0.5, 0.999999]) {
        const result = drawLegacyManual(
          { ...source, quality },
          policy,
          () => value,
        );
        expect(result.reduce((n, g) => n + g.quantity, 0)).toBe(
          policy.rules[quality].count,
        );
        expect(
          result.every((g) =>
            policy.rules[quality].realms.includes(
              policy.catalog.find((m) => m.definitionId === g.definitionId)!
                .realm,
            ),
          ),
        ).toBe(true);
      }
  });
  it('规则构建不持有可变配置引用', () => {
    const config = { s2: 1000, s3: 2000, distribution: 'existing' as const };
    const frozen = buildManualMigrationPolicy(config);
    config.s2 = 1;
    expect(frozen.config.s2).toBe(1000);
    expect(frozen.rules.天品.weights[0]).toBeCloseTo(5 / 6);
  });
  it('自选允许同名多本与低境界功法，拒绝超额、伪造、重复条目', () => {
    const grant = { definitionId: policy.catalog[0].definitionId, quantity: 2 };
    expect(validateManualSelection([grant], 2, policy)).toBe(2);
    expect(() => validateManualSelection([grant], 1, policy)).toThrow();
    expect(() =>
      validateManualSelection([{ ...grant, definitionId: 'fake' }], 2, policy),
    ).toThrow();
    expect(() => validateManualSelection([grant, grant], 4, policy)).toThrow();
    expect(
      ExchangeManualSchema.safeParse({
        productId: crypto.randomUUID(),
        selections: [{ ...grant, quantity: -1 }],
      }).success,
    ).toBe(false);
  });
  it('每本功法的自选必须一次选满，零奖励只接受空选择', () => {
    const grant = { definitionId: policy.catalog[0].definitionId, quantity: 1 };
    expect(validateManualSelection([], 0, policy)).toBe(0);
    expect(validateManualSelection([grant], 1, policy)).toBe(1);
    expect(
      validateManualSelection(
        [grant, { definitionId: policy.catalog[1].definitionId, quantity: 1 }],
        2,
        policy,
      ),
    ).toBe(2);
    expect(() => validateManualSelection([grant], 0, policy)).toThrow();
    expect(() => validateManualSelection([], 1, policy)).toThrow();
    expect(() => validateManualSelection([], 2, policy)).toThrow();
    expect(() => validateManualSelection([grant], 2, policy)).toThrow();
    for (const quantity of [0, -1, 0.5, NaN]) {
      expect(() =>
        validateManualSelection([{ ...grant, quantity }], 1, policy),
      ).toThrow();
    }
  });
});
