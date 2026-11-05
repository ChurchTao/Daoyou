import { expect, it } from 'vitest';
import { EnlightenmentRequestSchema } from './enlightenment.js';

const ref = { id: 'book', revision: 2, quantity: 4 };
const fullRequest = {
  requestId: '7bed6a43-1135-4c49-a753-622be1132b02',
  materials: [ref],
  expected: { realm: '合体', insightMultiplier: 1, qi: 32, insight: 128 },
};

it('拒绝无效请求标识和缺失预期费用', () => {
  for (const patch of [{ requestId: 'bad' }, { expected: undefined }]) {
    expect(
      EnlightenmentRequestSchema.safeParse({ ...fullRequest, ...patch }).success,
    ).toBe(false);
  }
});

it('接受一至四本与命格倍率后的确认费用', () => {
  for (const payload of [
    fullRequest,
    {
      ...fullRequest,
      materials: [{ ...ref, quantity: 1 }],
      expected: { realm: '炼气', insightMultiplier: 1, qi: 1, insight: 1 },
    },
    {
      ...fullRequest,
      expected: { ...fullRequest.expected, insightMultiplier: 1.5, insight: 192 },
    },
    {
      ...fullRequest,
      expected: { ...fullRequest.expected, insightMultiplier: 0.8, insight: 103 },
    },
  ]) {
    expect(EnlightenmentRequestSchema.parse(payload)).toEqual(payload);
  }
});

it('接受分堆投入的四本仙神混合请求及完整版本字段', () => {
  const payload = {
    ...fullRequest,
    materials: [
      { id: 'immortal-book', revision: 7, quantity: 2 },
      { id: 'divine-book', revision: 11, quantity: 2 },
    ],
    expected: { realm: '大乘', insightMultiplier: 1, qi: 30, insight: 104 },
  };
  expect(EnlightenmentRequestSchema.parse(payload)).toEqual(payload);
});

it('扩展灵气上限仍拒绝33点、超量和重复堆叠等无效完整请求', () => {
  const payload = fullRequest;
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
