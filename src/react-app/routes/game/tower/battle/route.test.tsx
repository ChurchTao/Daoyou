import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import type { Cultivator } from '@shared/types/cultivator';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@app/lib/contexts/CultivatorContext', () => ({
  useCultivator: vi.fn(),
}));

vi.mock('@app/lib/hooks/tower/useTowerBattleContext', () => ({
  useTowerBattleContext: vi.fn(),
}));

vi.mock('@app/lib/hooks/tower/useTowerBattle', () => ({
  useTowerBattle: vi.fn(),
}));

vi.mock('@app/components/feature/battle/useBattlePlaybackState', () => ({
  useBattlePlaybackState: vi.fn(),
}));

import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { useTowerBattle } from '@app/lib/hooks/tower/useTowerBattle';
import { useTowerBattleContext } from '@app/lib/hooks/tower/useTowerBattleContext';
import TowerBattlePage from './route';

const mockedUseCultivator = useCultivator as unknown as {
  mockReturnValue: (value: unknown) => void;
};
const mockedUseTowerBattleContext = useTowerBattleContext as unknown as {
  mockReturnValue: (value: unknown) => void;
};
const mockedUseTowerBattle = useTowerBattle as unknown as {
  mockReturnValue: (value: unknown) => void;
};
const mockedUseBattlePlaybackState = useBattlePlaybackState as unknown as {
  mockReturnValue: (value: unknown) => void;
};

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

describe('TowerBattlePage', () => {
  it('does not render enemy description cards inside the battle view', () => {
    const battleResult = simulateBattleV5(
      createCultivator('player', '林玄'),
      createCultivator('opponent', '幻影敌手'),
    );
    const finalFrame =
      battleResult.stateTimeline.frames.at(-1)?.units ??
      battleResult.stateTimeline.frames[0]!.units;

    mockedUseCultivator.mockReturnValue({
      cultivator: createCultivator('player', '林玄'),
      refreshCultivator: vi.fn(),
    } as any);
    mockedUseTowerBattleContext.mockReturnValue({
      context: {
        encounter: {
          floor: 9,
          kind: 'ELITE',
          realm: '筑基',
          realmStage: '中期',
        },
        enemy: {
          title: '蜃影',
          name: '幻影敌手',
          description: '这段敌人描述不应在战斗页出现。',
          background: '这段敌人背景不应在战斗页出现。',
        },
      },
      error: undefined,
      loading: false,
    } as any);
    mockedUseTowerBattle.mockReturnValue({
      battleResult,
      loading: false,
      executeBattle: vi.fn(),
    } as any);
    mockedUseBattlePlaybackState.mockReturnValue({
      currentIndex: Math.max(battleResult.logSpans.length - 1, -1),
      totalActions: battleResult.logSpans.length,
      progress: 100,
      isPlaying: false,
      playbackSpeed: 1,
      setPlaybackSpeed: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      reset: vi.fn(),
      currentPlayerFrame: finalFrame[battleResult.player],
      currentOpponentFrame: finalFrame[battleResult.opponent],
      playerName: '林玄',
      opponentName: '幻影敌手',
      isReplaySupported: true,
      isPlaybackFinished: true,
      selectedUnit: null,
      openUnitDetails: vi.fn(),
      closeUnitDetails: vi.fn(),
    } as any);

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/game/tower/battle?battleId=battle-1']}>
        <TowerBattlePage />
      </MemoryRouter>,
    );

    expect(html).toContain('战斗日志');
    expect(html).not.toContain('这段敌人描述不应在战斗页出现。');
    expect(html).not.toContain('这段敌人背景不应在战斗页出现。');
  });
});
