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
        type: 'ability_mode',
        name: '魔相·止观',
        remainingActions: 2,
      }),
    ).toBe('「魔相·止观」（2回合）');
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
            durationUnit: 'owner_action',
            isPermanent: false,
            sourceName: '魁星士',
          },
          {
            id: 'stun',
            name: '眩晕',
            type: 'control',
            layers: 1,
            remaining: 1,
            durationUnit: 'owner_action',
            isPermanent: false,
          },
          {
            id: 'armor-break',
            name: '破甲',
            type: 'debuff',
            layers: 2,
            remaining: 2,
            durationUnit: 'owner_action',
            isPermanent: false,
          },
          {
            id: 'sword-mark',
            name: '剑痕',
            type: 'buff',
            layers: 2,
            remaining: 3,
            durationUnit: 'owner_action',
            isPermanent: false,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ label: '[调息·1]', tone: 'default' }),
      expect.objectContaining({ label: '[蓄势·听雷沉山]', tone: 'default' }),
      expect.objectContaining({ label: '「眩晕」（1回合）', tone: 'debuff' }),
      expect.objectContaining({ label: '「破甲×2」（2回合）', tone: 'debuff' }),
      expect.objectContaining({
        label: '「剑意冲霄」（3回合）',
        tone: 'buff',
        title: '剑意冲霄 · 余3次自身行动；来源：魁星士；物攻提高。',
      }),
      expect.objectContaining({ label: '「剑痕×2」（3回合）', tone: 'buff' }),
    ]);
  });

  it('按持续时间单位区分自身行动与整轮', () => {
    expect(
      getCompactStatusTags({
        buffs: [
          {
            id: 'owner-action',
            name: '凝神',
            type: 'buff',
            layers: 1,
            remaining: 2,
            durationUnit: 'owner_action',
            isPermanent: false,
          },
          {
            id: 'round',
            name: '天时',
            type: 'buff',
            layers: 1,
            remaining: 2,
            durationUnit: 'round',
            isPermanent: false,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ label: '「凝神」（2回合）' }),
      expect.objectContaining({ label: '「天时」（2轮）' }),
    ]);
  });

  it('顶部隐藏常驻与调试状态，普通临时状态正常展示', () => {
    expect(
      getCompactStatusTags({
        buffs: [
          {
            id: 'permanent',
            name: '常驻剑体',
            type: 'buff',
            layers: 1,
            remaining: -1,
            durationUnit: 'owner_action',
            isPermanent: true,
          },
          {
            id: 'debug-marker',
            name: '内部计数',
            type: 'buff',
            layers: 1,
            remaining: 2,
            durationUnit: 'owner_action',
            isPermanent: false,
            logVisibility: 'debug',
          },
          {
            id: 'normal-buff',
            name: '普通增益',
            type: 'buff',
            layers: 1,
            remaining: 2,
            durationUnit: 'owner_action',
            isPermanent: false,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ label: '「普通增益」（2回合）', tone: 'buff' }),
    ]);
  });

  it('状态展示可独立于调试日志显式开放', () => {
    expect(
      getCompactStatusTags({
        buffs: [
          {
            id: 'sect.tianyan.element-seal',
            name: '火印',
            type: 'buff',
            layers: 1,
            remaining: 2,
            durationUnit: 'owner_action',
            isPermanent: false,
            logVisibility: 'debug',
            statusVisibility: 'player',
          },
          {
            id: 'internal-marker',
            name: '内部标记',
            type: 'buff',
            layers: 1,
            remaining: 2,
            durationUnit: 'owner_action',
            isPermanent: false,
            logVisibility: 'debug',
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({ label: '「火印」（2回合）', tone: 'buff' }),
    ]);
  });
});
