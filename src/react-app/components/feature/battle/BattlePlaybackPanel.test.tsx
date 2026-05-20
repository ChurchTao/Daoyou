import type { BattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import type { Cultivator } from '@shared/types/cultivator';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BattlePlaybackPanel } from './BattlePlaybackPanel';

function createCultivator(id: string, name: string): Cultivator {
  return {
    id,
    name,
    age: 18,
    lifespan: 120,
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: { artifacts: [], consumables: [], materials: [] },
    equipped: { weapon: null, armor: null, accessory: null },
    max_skills: 0,
    spirit_stones: 0,
    gender: '男',
    realm: '炼气',
    realm_stage: '初期',
  };
}

function createPlaybackState(
  battleResult: ReturnType<typeof simulateBattleV5>,
  overrides: Partial<BattlePlaybackState> = {},
): BattlePlaybackState {
  const finalFrame =
    battleResult.stateTimeline.frames.at(-1)?.units ?? battleResult.stateTimeline.frames[0]?.units;

  return {
    currentIndex: Math.max(battleResult.logSpans.length - 1, -1),
    totalActions: battleResult.logSpans.length,
    progress: battleResult.logSpans.length > 0 ? 100 : 0,
    isPlaying: false,
    playbackSpeed: 1,
    setPlaybackSpeed: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    currentPlayerFrame: finalFrame?.[battleResult.player],
    currentOpponentFrame: finalFrame?.[battleResult.opponent],
    playerName: battleResult.winner.id === battleResult.player
      ? battleResult.winner.name
      : battleResult.loser.name,
    opponentName: battleResult.winner.id === battleResult.opponent
      ? battleResult.winner.name
      : battleResult.loser.name,
    isReplaySupported: true,
    isPlaybackFinished: true,
    selectedUnit: null,
    setSelectedUnit: vi.fn(),
    ...overrides,
  };
}

describe('BattlePlaybackPanel', () => {
  it('renders the shared combat status, controls, and log for a supported record', () => {
    const battleResult = simulateBattleV5(
      createCultivator('player', '林玄'),
      createCultivator('opponent', '赵青'),
    );

    const html = renderToStaticMarkup(
      <BattlePlaybackPanel
        battleResult={battleResult}
        playback={createPlaybackState(battleResult)}
      />,
    );

    expect(html).toContain('战斗日志');
    expect(html).toContain('我的状态');
    expect(html).toContain('[详细属性]');
    expect(html).toContain('[敌方状态]');
    expect(html).toContain('赵青');
    expect(html).toContain('林玄');
  });

  it('shows only the unsupported notice when replay data is incomplete', () => {
    const battleResult = simulateBattleV5(
      createCultivator('player', '林玄'),
      createCultivator('opponent', '赵青'),
    );

    const html = renderToStaticMarkup(
      <BattlePlaybackPanel
        battleResult={{
          ...battleResult,
          logSpans: [],
          stateTimeline: {
            ...battleResult.stateTimeline,
            frames: [],
          },
        }}
        playback={createPlaybackState(battleResult, {
          currentPlayerFrame: undefined,
          currentOpponentFrame: undefined,
          isReplaySupported: false,
          isPlaybackFinished: false,
          totalActions: 0,
          currentIndex: -1,
          progress: 0,
        })}
        unsupportedNotice={
          <p>该战斗记录不支持新版回放（缺少关键时间线数据）。</p>
        }
      />,
    );

    expect(html).toContain('该战斗记录不支持新版回放');
    expect(html).not.toContain('战斗日志');
    expect(html).not.toContain('我的状态');
  });
});
