import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Cultivator } from '@shared/types/cultivator';

vi.mock('@app/lib/contexts/CultivatorContext', () => ({
  useCultivator: vi.fn(),
}));

vi.mock('@app/components/providers/InkUIProvider', () => ({
  useInkUI: () => ({
    openDialog: vi.fn(),
    pushToast: vi.fn(),
  }),
}));

vi.mock('@app/components/game-shell', () => ({
  GameSceneFrame: ({ title, description, aside, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      <div>{aside}</div>
      <div>{children}</div>
    </div>
  ),
  GameSceneSection: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  GameSceneAsideSection: ({ title, children }: any) => (
    <aside>
      <h3>{title}</h3>
      {children}
    </aside>
  ),
}));

import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import InnRecoveryPage from './route';

function createCultivator(overrides?: Partial<Cultivator>): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    gender: '男',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    status: 'active',
    attributes: {
      vitality: 40,
      spirit: 36,
      wisdom: 30,
      speed: 28,
      willpower: 32,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    max_skills: 4,
    spirit_stones: 9000,
    cultivation_progress: {
      cultivation_exp: 880,
      exp_cap: 1000,
      comprehension_insight: 40,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
    condition: {
      version: 1,
      resources: {
        hp: { current: 120 },
        mp: { current: 80 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {
        lastRecoveryAt: '2026-05-25T00:00:00.000Z',
      },
    },
    ...overrides,
  };
}

const mockedUseCultivator = vi.mocked(useCultivator);

describe('InnRecoveryPage', () => {
  it('renders an immersive inn stay card without exposing the rule numbers on first screen', () => {
    mockedUseCultivator.mockReturnValue({
      cultivator: createCultivator({
        condition: {
          ...createCultivator().condition!,
          resources: {
            hp: { current: 80 },
            mp: { current: 35 },
          },
          gauges: {
            pillToxicity: 18,
          },
          statuses: [
            {
              key: 'minor_wound',
              stacks: 1,
              source: 'battle',
              duration: { kind: 'until_removed' },
              createdAt: '2026-05-25T00:00:00.000Z',
              updatedAt: '2026-05-25T00:00:00.000Z',
            },
          ],
        },
      }),
      display: {
        resources: {
          hp: { current: 80, max: 200, percent: 40 },
          mp: { current: 35, max: 120, percent: 29.17 },
        },
      },
      isLoading: false,
      refreshCultivator: vi.fn(),
    } as any);

    const html = renderToStaticMarkup(<InnRecoveryPage />);

    expect(html).toContain('门帘半掩，灯火暖黄');
    expect(html).toContain('药香混着热水白气从后院慢慢漫出来');
    expect(html).toContain('上楼住店');
    expect(html).toContain('若要歇脚养伤，与掌柜知会一声便可');
    expect(html).not.toContain('3000 灵石');
    expect(html).not.toContain('5%-10%');
    expect(html).not.toContain('当前道体');
  });

  it('disables recovery when hp/mp are full and no status remains, even if pill toxicity exists', () => {
    mockedUseCultivator.mockReturnValue({
      cultivator: createCultivator({
        spirit_stones: 12000,
        condition: {
          ...createCultivator().condition!,
          gauges: {
            pillToxicity: 12,
          },
        },
      }),
      display: {
        resources: {
          hp: { current: 120, max: 120, percent: 100 },
          mp: { current: 80, max: 80, percent: 100 },
        },
      },
      isLoading: false,
      refreshCultivator: vi.fn(),
    } as any);

    const html = renderToStaticMarkup(<InnRecoveryPage />);

    expect(html).toContain('你此刻气息尚稳');
    expect(html).toContain('若只是想散去丹毒，这间客栈帮不上忙');
    expect(html).toContain('disabled=""');
  });
});
