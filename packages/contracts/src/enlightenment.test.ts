import { expect, it } from 'vitest';
import { EnlightenmentRequestSchema } from './enlightenment.js';

const ref = { id: 'book', revision: 0, quantity: 4 };

const qualities = [
  { quality: '凡品', realm: '炼气', qi: 1, insight: 1 },
  { quality: '灵品', realm: '炼气', qi: 2, insight: 2 },
  { quality: '玄品', realm: '炼气', qi: 3, insight: 3 },
  { quality: '真品', realm: '筑基', qi: 4, insight: 5 },
  { quality: '地品', realm: '金丹', qi: 5, insight: 8 },
  { quality: '天品', realm: '元婴', qi: 6, insight: 12 },
  { quality: '仙品', realm: '化神', qi: 7, insight: 20 },
  { quality: '神品', realm: '合体', qi: 8, insight: 32 },
] as const;

function request(quality: (typeof qualities)[number], quantity: number) {
  return {
    requestId: '7bed6a43-1135-4c49-a753-622be1132b02',
    materials: [{ ...ref, revision: 2, quantity }],
    expected: {
      realm: quality.realm,
      insightMultiplier: 1,
      qi: quality.qi * quantity,
      insight: quality.insight * quantity,
    },
  };
}

it('拒绝无效请求标识和缺失预期费用', () => {
  expect(
    EnlightenmentRequestSchema.safeParse({
      requestId: 'bad',
      materials: [ref],
    }).success,
  ).toBe(false);
});

it.each(qualities)(
  '$quality典籍一至四本的完整客户端请求均通过契约',
  (quality) => {
    for (let quantity = 1; quantity <= 4; quantity++) {
      const payload = request(quality, quantity);
      expect(EnlightenmentRequestSchema.parse(payload)).toEqual(payload);
    }
  },
);

it('四本神品允许32灵气及128感悟，命格倍率后的感悟不受旧费用上限限制', () => {
  const payload = request(qualities[7], 4);
  expect(EnlightenmentRequestSchema.parse(payload).expected).toEqual({
    realm: '合体',
    insightMultiplier: 1,
    qi: 32,
    insight: 128,
  });
  payload.expected.insightMultiplier = 1.5;
  payload.expected.insight = 192;
  expect(EnlightenmentRequestSchema.parse(payload)).toEqual(payload);
  payload.expected.insightMultiplier = 0.8;
  payload.expected.insight = 103;
  expect(EnlightenmentRequestSchema.parse(payload)).toEqual(payload);
});

it('接受分堆投入的四本仙神混合请求及完整版本字段', () => {
  const payload = {
    ...request(qualities[7], 4),
    materials: [
      { id: 'immortal-book', revision: 7, quantity: 2 },
      { id: 'divine-book', revision: 11, quantity: 2 },
    ],
    expected: { realm: '大乘', insightMultiplier: 1, qi: 30, insight: 104 },
  };
  expect(EnlightenmentRequestSchema.parse(payload)).toEqual(payload);
});

it('扩展灵气上限仍拒绝33点、超量和重复堆叠等无效完整请求', () => {
  const payload = request(qualities[7], 4);
  for (const invalid of [
    { ...payload, expected: { ...payload.expected, qi: 33 } },
    { ...payload, expected: { ...payload.expected, qi: 0 } },
    { ...payload, expected: { ...payload.expected, insight: 0 } },
    { ...payload, materials: [{ ...ref, quantity: 5 }] },
    {
      ...payload,
      materials: [
        { ...ref, quantity: 3 },
        { ...ref, id: 'another', quantity: 2 },
      ],
    },
    {
      ...payload,
      materials: [
        { ...ref, quantity: 2 },
        { ...ref, quantity: 2 },
      ],
    },
  ])
    expect(EnlightenmentRequestSchema.safeParse(invalid).success).toBe(false);
});
