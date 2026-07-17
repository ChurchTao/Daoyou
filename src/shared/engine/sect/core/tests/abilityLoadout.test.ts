import { describe, expect, it } from 'vitest';
import { createAbilitySlots, fillFirstEmptyAbilitySlots } from '..';

describe('宗门神通装配', () => {
  it('固定保留四个稀疏槽位', () => {
    expect(createAbilitySlots(['guiding-sword', null, 'turning-body'])).toEqual(
      ['guiding-sword', null, 'turning-body', null],
    );
  });

  it('只将尚未装配的已解锁神通填入空槽', () => {
    expect(
      fillFirstEmptyAbilitySlots(
        ['guiding-sword', null, 'turning-body', null],
        ['guiding-sword', 'linked-edge', 'breaking-edge'],
      ),
    ).toEqual([
      'guiding-sword',
      'linked-edge',
      'turning-body',
      'breaking-edge',
    ]);
  });
});
