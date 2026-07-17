import type { SectPathDefinition } from '@shared/engine/sect';
import { describe, expect, it } from 'vitest';
import {
  createMeridianDrafts,
  getMeridianFooterAction,
  hasDirtyMeridianDraft,
  isMeridianDraftDirty,
  mergeFreshMeridianState,
  toggleMeridianNode,
} from './pathEditorState';

const path = {
  nodes: [
    { id: 'a', layerId: '1', name: '甲', description: '' },
    { id: 'b', layerId: '1', name: '乙', description: '' },
    { id: 'c', layerId: '2', name: '丙', description: '' },
  ],
} as SectPathDefinition;

describe('流派参悟抽屉草稿', () => {
  it('同层选择会替换，再次点击可取消', () => {
    expect(
      toggleMeridianNode({ path, selected: ['a', 'c'], nodeId: 'b' }),
    ).toEqual(['c', 'b']);
    expect(
      toggleMeridianNode({ path, selected: ['a', 'c'], nodeId: 'a' }),
    ).toEqual(['c']);
  });

  it('分别识别三套方案的未保存修改', () => {
    const saved = createMeridianDrafts();
    const drafts = { ...saved, 2: ['a'] };
    expect(isMeridianDraftDirty(drafts, saved, 1)).toBe(false);
    expect(isMeridianDraftDirty(drafts, saved, 2)).toBe(true);
    expect(hasDirtyMeridianDraft(drafts, saved)).toBe(true);
  });

  it('服务端刷新只覆盖没有本地改动的方案', () => {
    const saved = { 1: ['a'], 2: [], 3: [] };
    const drafts = { 1: ['b'], 2: [], 3: [] };
    const fresh = { 1: ['a'], 2: ['c'], 3: [] };
    expect(mergeFreshMeridianState(drafts, saved, fresh)).toEqual({
      1: ['b'],
      2: ['c'],
      3: [],
    });
  });

  it('页脚优先保存当前方案，并阻止带其他未保存草稿时直接激活', () => {
    const saved = createMeridianDrafts();
    expect(
      getMeridianFooterAction({
        drafts: { ...saved, 2: ['a'] },
        saved,
        slot: 2,
        activeSlot: 1,
      }),
    ).toBe('save');
    expect(
      getMeridianFooterAction({
        drafts: { ...saved, 2: ['a'] },
        saved,
        slot: 3,
        activeSlot: 1,
      }),
    ).toBe('resolve-dirty');
    expect(
      getMeridianFooterAction({
        drafts: saved,
        saved,
        slot: 2,
        activeSlot: 1,
      }),
    ).toBe('activate');
    expect(
      getMeridianFooterAction({
        drafts: saved,
        saved,
        slot: 1,
        activeSlot: 1,
      }),
    ).toBe('current');
  });
});
