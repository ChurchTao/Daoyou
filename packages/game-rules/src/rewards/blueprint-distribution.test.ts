import { describe, expect, it } from 'vitest';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { blueprintRealmWeights } from './blueprint-distribution.js';

const weightsOf = (
  realm: (typeof REALM_VALUES)[number],
  profile: 'yield' | 'lower' | 'near' | 'dungeon',
) =>
  Object.fromEntries(
    blueprintRealmWeights(realm, profile).map((row) => [row.realm, row.weight]),
  );

describe('图纸境界权重', () => {
  it('历练按低一境、本境、高一境 4:4:2，炼气把缺失的低境并进本境', () => {
    expect(weightsOf('炼气', 'yield')).toEqual({ 炼气: 8, 筑基: 2 });
    expect(weightsOf('筑基', 'yield')).toEqual({ 炼气: 4, 筑基: 4, 金丹: 2 });
    expect(weightsOf('金丹', 'yield')).toEqual({ 筑基: 4, 金丹: 4, 元婴: 2 });
    expect(weightsOf('炼虚', 'yield')).toEqual({ 化神: 4, 炼虚: 4, 合体: 2 });
  });

  it('历练高出合体的份额并进合体，大乘和渡劫只发合体', () => {
    expect(weightsOf('合体', 'yield')).toEqual({ 炼虚: 4, 合体: 6 });
    expect(weightsOf('大乘', 'yield')).toEqual({ 合体: 10 });
    expect(weightsOf('渡劫', 'yield')).toEqual({ 合体: 10 });
  });

  it('蜃楼主图纸覆盖低三境到本境，越近权重越低', () => {
    expect(weightsOf('炼气', 'lower')).toEqual({ 炼气: 1 });
    expect(weightsOf('筑基', 'lower')).toEqual({ 炼气: 2, 筑基: 1 });
    expect(weightsOf('元婴', 'lower')).toEqual({
      炼气: 8,
      筑基: 4,
      金丹: 2,
      元婴: 1,
    });
    expect(weightsOf('渡劫', 'lower')).toEqual({
      炼虚: 8,
      合体: 4,
      大乘: 2,
      渡劫: 1,
    });
  });

  it('云游元婴及以下只发本境，更高地图去掉元婴以下', () => {
    expect(weightsOf('炼气', 'dungeon')).toEqual({ 炼气: 1 });
    expect(weightsOf('筑基', 'dungeon')).toEqual({ 筑基: 1 });
    expect(weightsOf('金丹', 'dungeon')).toEqual({ 金丹: 1 });
    expect(weightsOf('元婴', 'dungeon')).toEqual({ 元婴: 1 });
    expect(weightsOf('化神', 'dungeon')).toEqual({ 元婴: 2, 化神: 1 });
    expect(weightsOf('炼虚', 'dungeon')).toEqual({ 元婴: 4, 化神: 2, 炼虚: 1 });
    expect(weightsOf('合体', 'dungeon')).toEqual({
      元婴: 8,
      化神: 4,
      炼虚: 2,
      合体: 1,
    });
    expect(weightsOf('大乘', 'dungeon')).toEqual({
      化神: 8,
      炼虚: 4,
      合体: 2,
      大乘: 1,
    });
    expect(weightsOf('渡劫', 'dungeon')).toEqual({
      炼虚: 8,
      合体: 4,
      大乘: 2,
      渡劫: 1,
    });
  });

  it('额外图纸只覆盖低一境和本境', () => {
    expect(weightsOf('金丹', 'near')).toEqual({ 筑基: 4, 金丹: 1 });
    expect(weightsOf('渡劫', 'near')).toEqual({ 大乘: 4, 渡劫: 1 });
  });
});
