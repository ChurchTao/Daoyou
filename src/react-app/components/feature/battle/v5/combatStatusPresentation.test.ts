import {
  formatCompactActionState,
  getCombatResourceDisplay,
  getCompactStatusTags,
} from './combatStatusPresentation';

describe('战斗状态紧凑展示', () => {
  it.each([0, 1, 4, 6])('剑势%d点使用对应数量的图标', (current) => {
    const display = getCombatResourceDisplay({
      id: 'sect.lingxiao.sword-momentum',
      name: '剑势',
      icon: '🗡️',
      current,
      max: 6,
    });
    expect(display).toEqual({
      mode: 'pips',
      value: current > 0 ? '🗡️'.repeat(current) : '无',
      accessibleLabel: `剑势${current}/6`,
    });
  });

  it('无图标资源沿用进度条', () => {
    expect(
      getCombatResourceDisplay({
        id: 'focus',
        name: '专注',
        current: 3,
        max: 10,
      }),
    ).toEqual({
      mode: 'bar',
      value: '3/10',
      accessibleLabel: '专注3/10',
    });
  });

  it('行动状态使用无边框方括号文案', () => {
    expect(
      formatCompactActionState({
        type: 'rest',
        name: '调息',
        remainingActions: 1,
      }),
    ).toBe('[调息·1]');
    expect(
      formatCompactActionState({
        type: 'queued_action',
        name: '蓄势',
        remainingActions: 1,
        ability: { id: 'thunder', name: '听雷沉山' },
      }),
    ).toBe('[蓄势·听雷沉山]');
  });

  it('按行动状态、负面状态、正面状态的顺序生成临时状态标签', () => {
    expect(
      getCompactStatusTags({
        actionStates: [
          {
            type: 'rest',
            name: '调息',
            remainingActions: 1,
            sourceAbility: { id: 'starfall', name: '剑落星河' },
          },
          {
            type: 'queued_action',
            name: '蓄势',
            remainingActions: 1,
            ability: { id: 'thunder', name: '听雷沉山' },
          },
        ],
        buffs: [
          {
            id: 'sword-intent',
            name: '剑意冲霄',
            description: '物攻提高。',
            type: 'buff',
            layers: 1,
            remaining: 3,
            isPermanent: false,
            sourceName: '魁星士',
          },
          {
            id: 'stun',
            name: '眩晕',
            type: 'control',
            layers: 1,
            remaining: 1,
            isPermanent: false,
          },
          {
            id: 'armor-break',
            name: '破甲',
            type: 'debuff',
            layers: 2,
            remaining: 2,
            isPermanent: false,
          },
          {
            id: 'sword-mark',
            name: '剑痕',
            type: 'buff',
            layers: 2,
            remaining: 3,
            isPermanent: false,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ label: '[调息·1]', tone: 'default' }),
      expect.objectContaining({ label: '[蓄势·听雷沉山]', tone: 'default' }),
      expect.objectContaining({ label: '[眩晕·1]', tone: 'debuff' }),
      expect.objectContaining({ label: '[破甲×2·2]', tone: 'debuff' }),
      expect.objectContaining({
        label: '[剑意冲霄·3]',
        tone: 'buff',
        title: '剑意冲霄 · 余3次自身行动；来源：魁星士；物攻提高。',
      }),
      expect.objectContaining({ label: '[剑痕×2·3]', tone: 'buff' }),
    ]);
  });

  it('顶部隐藏常驻与调试状态，旧快照缺少可见性时仍展示', () => {
    expect(
      getCompactStatusTags({
        buffs: [
          {
            id: 'permanent',
            name: '常驻剑体',
            type: 'buff',
            layers: 1,
            remaining: -1,
            isPermanent: true,
          },
          {
            id: 'debug-marker',
            name: '内部计数',
            type: 'buff',
            layers: 1,
            remaining: 2,
            isPermanent: false,
            logVisibility: 'debug',
          },
          {
            id: 'legacy-buff',
            name: '旧记录增益',
            type: 'buff',
            layers: 1,
            remaining: 2,
            isPermanent: false,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ label: '[旧记录增益·2]', tone: 'buff' }),
    ]);
  });
});
