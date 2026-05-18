import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { GameTopHud } from './GameTopHud';
import type { GameHudSnapshot } from './useGameHudModel';

const snapshot: GameHudSnapshot = {
  name: '林玄',
  realm: '练气',
  realmStage: '练气三层',
  title: '问剑客',
  spiritStones: 128,
  unreadMailCount: 3,
  statusText: '安稳无恙',
  activeStatuses: [],
  metrics: [
    { key: 'hp', label: 'HP', display: '80/100', percent: 80, tone: 'hp' },
    { key: 'mp', label: 'MP', display: '60/100', percent: 60, tone: 'mp' },
    {
      key: 'cultivation',
      label: '修为',
      display: '45%',
      percent: 45,
      tone: 'progress',
    },
    {
      key: 'insight',
      label: '感悟',
      display: '21/100',
      percent: 21,
      tone: 'insight',
    },
  ],
};

describe('GameTopHud', () => {
  it('links the whole HUD to the cultivator scene page', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <GameTopHud snapshot={snapshot} />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/game/cultivator"');
    expect(html).toContain('林玄');
  });
});
