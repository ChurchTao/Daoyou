import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import type { Cultivator } from '@shared/types/cultivator';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  isBattleReplaySupported,
  resolveBattlePlaybackNames,
  resolvePlaybackStateForRecord,
  useBattlePlaybackState,
} from './useBattlePlaybackState';

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

function PlaybackProbe({
  record,
}: {
  record: ReturnType<typeof simulateBattleV5>;
}) {
  const playback = useBattlePlaybackState(record);

  return (
    <pre>
      {JSON.stringify({
        playerName: playback.playerName,
        opponentName: playback.opponentName,
        isReplaySupported: playback.isReplaySupported,
        isPlaybackFinished: playback.isPlaybackFinished,
        currentIndex: playback.currentIndex,
        totalActions: playback.totalActions,
      })}
    </pre>
  );
}

describe('useBattlePlaybackState', () => {
  it('derives playback names and support flags from a battle record', () => {
    const battleResult = simulateBattleV5(
      createCultivator('player', '林玄'),
      createCultivator('opponent', '赵青'),
    );

    expect(resolveBattlePlaybackNames(battleResult)).toEqual({
      playerName: '林玄',
      opponentName: '赵青',
    });
    expect(isBattleReplaySupported(battleResult)).toBe(true);

    const html = renderToStaticMarkup(<PlaybackProbe record={battleResult} />);

    expect(html).toContain('&quot;playerName&quot;:&quot;林玄&quot;');
    expect(html).toContain('&quot;opponentName&quot;:&quot;赵青&quot;');
    expect(html).toContain('&quot;isReplaySupported&quot;:true');
    expect(html).toContain('&quot;isPlaybackFinished&quot;:false');
    expect(html).toContain('&quot;currentIndex&quot;:-1');
  });

  it('resets playback state when the bound battle record changes', () => {
    const firstRecord = simulateBattleV5(
      createCultivator('player', '林玄'),
      createCultivator('opponent', '赵青'),
    );
    const nextRecord = simulateBattleV5(
      createCultivator('player-2', '苏夜'),
      createCultivator('opponent-2', '韩川'),
    );

    expect(
      resolvePlaybackStateForRecord(
        {
          record: firstRecord,
          currentIndex: 3,
          isPlaying: true,
        },
        nextRecord,
      ),
    ).toEqual({
      record: nextRecord,
      currentIndex: -1,
      isPlaying: false,
    });
  });
});
