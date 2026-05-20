import type { Cultivator } from '@shared/types/cultivator';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@app/lib/contexts/CultivatorContext', () => ({
  useCultivator: vi.fn(),
}));

vi.mock('@app/layouts/special-scene', () => ({
  useSpecialSceneBackAction: vi.fn(),
}));

import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import TrainingRoomPage from './route';

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

const mockedUseCultivator = vi.mocked(useCultivator);

describe('TrainingRoomPage', () => {
  it('keeps the pre-battle guide and custom setup UI when no battle has started', () => {
    mockedUseCultivator.mockReturnValue({
      cultivator: createCultivator('player', '林玄'),
      isLoading: false,
    } as any);

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TrainingRoomPage />
      </MemoryRouter>,
    );

    expect(html).toContain('练功说明');
    expect(html).toContain('直接开始训练');
    expect(html).toContain('打开自定义设置');
    expect(html).not.toContain('战斗日志');
    expect(html).not.toContain('我的状态');
  });
});
