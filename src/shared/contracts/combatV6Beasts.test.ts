import { describe, expect, it } from 'vitest';
import { createTextFilter } from '../text-filter';
import { BeastNameSchema, BeastRenameSchema } from './combatV6Beasts';

describe('灵兽改名', () => {
  it.each([
    '雷',
    '一二三四五六七',
    'abcdefg',
    '𠮷𠮷𠮷𠮷𠮷𠮷𠮷',
    '小雷😀',
    '**',
  ])('接受最多7个码点：%s', (name) => {
    expect(BeastNameSchema.parse(name)).toBe(name);
  });
  it('去除首尾空白后校验长度', () => {
    expect(BeastNameSchema.parse('  一二三四五六七  ')).toBe('一二三四五六七');
  });
  it.each([
    '',
    '   ',
    '一二三四五六七八',
    'abcdefgh',
    '小 雷',
    '小\n雷',
    '小\t雷',
    '小\u200b雷',
    '小\u200d雷',
    '小\u2060雷',
    '小\u202e雷',
    '小\u0000雷',
    '\u3164',
  ])('拒绝超长或不可见名字：%j', (name) => {
    expect(BeastNameSchema.safeParse(name).success).toBe(false);
  });
  it('过滤后仍符合名称约束，允许全部打码', () => {
    const filter = createTextFilter({
      blockedWords: ['坏蛋'],
      allowedPhrases: [],
    });
    expect(
      BeastNameSchema.parse(filter.mask(BeastNameSchema.parse('坏.蛋')).text),
    ).toBe('***');
  });
  it('请求要求灵兽ID与非负修订号，禁止传入归属', () => {
    const request = {
      beastId: '00000000-0000-4000-8000-000000000001',
      expectedRevision: 0,
      name: '小雷',
    };
    expect(BeastRenameSchema.parse(request)).toEqual(request);
    expect(
      BeastRenameSchema.safeParse({ ...request, expectedRevision: -1 }).success,
    ).toBe(false);
    expect(
      BeastRenameSchema.safeParse({ ...request, beastId: 'bad' }).success,
    ).toBe(false);
    expect(
      BeastRenameSchema.safeParse({
        ...request,
        ownerCultivatorId: request.beastId,
      }).success,
    ).toBe(false);
  });
});
