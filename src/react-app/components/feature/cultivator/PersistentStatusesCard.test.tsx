import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CultivatorCurrentStatusSection,
  CultivatorTrackSection,
} from './PersistentStatusesCard';
import {
  getPillToxicityEffectDetails,
  getStatusEffectDetails,
} from './persistentStatusDetails';

const mockUseCultivator = vi.fn();
const mockGetBreakthroughPenaltyPercent = vi.fn();
const mockIsConditionStatusActive = vi.fn();
const mockGetPillToxicityStage = vi.fn();
const mockGetPillToxicityRecoveryMultiplier = vi.fn();
const mockGetNaturalRecoveryEstimate = vi.fn();
const mockGetConditionStatusTemplate = vi.fn();
const mockGetAllTrackConfigs = vi.fn();

vi.mock('@app/lib/contexts/CultivatorContext', () => ({
  useCultivator: () => mockUseCultivator(),
}));

vi.mock('@shared/lib/condition', () => ({
  getBreakthroughPenaltyPercent: (...args: unknown[]) =>
    mockGetBreakthroughPenaltyPercent(...args),
  isConditionStatusActive: (...args: unknown[]) =>
    mockIsConditionStatusActive(...args),
  getPillToxicityStage: (...args: unknown[]) => mockGetPillToxicityStage(...args),
  getPillToxicityRecoveryMultiplier: (...args: unknown[]) =>
    mockGetPillToxicityRecoveryMultiplier(...args),
  getNaturalRecoveryEstimate: (...args: unknown[]) =>
    mockGetNaturalRecoveryEstimate(...args),
}));

vi.mock('@shared/lib/conditionStatusRegistry', () => ({
  getConditionStatusTemplate: (...args: unknown[]) =>
    mockGetConditionStatusTemplate(...args),
}));

vi.mock('@shared/lib/trackConfigRegistry', () => ({
  getAllTrackConfigs: () => mockGetAllTrackConfigs(),
}));

describe('PersistentStatusesCard sections', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00.000Z'));

    mockIsConditionStatusActive.mockReturnValue(true);
    mockGetBreakthroughPenaltyPercent.mockReturnValue(1.2);
    mockGetPillToxicityStage.mockReturnValue({ key: 'alert', label: '毒息未散' });
    mockGetPillToxicityRecoveryMultiplier.mockReturnValue(0.933);
    mockGetNaturalRecoveryEstimate.mockImplementation(
      ({ resource }: { resource: 'hp' | 'mp' }) =>
        resource === 'hp'
          ? { perHour: 9.6, timeToFullMs: 4 * 3600 * 1000 + 10 * 60 * 1000, isFull: false }
          : { perHour: 10.8, timeToFullMs: 112 * 60 * 1000, isFull: false },
    );
    mockGetConditionStatusTemplate.mockReturnValue({
      name: '福缘护体',
      description: '护住经脉',
      effectDetails: ['战斗时最大气血降低 10%', '自然恢复速度降低至 88%'],
      display: {
        icon: '✨',
        shortDesc: '经脉受护',
      },
    });
    mockGetAllTrackConfigs.mockReturnValue([
      {
        key: 'marrow_wash',
        name: '洗髓',
        shortDesc: '升级后所有灵根各提升 1 点',
        thresholdByLevel: (level: number) => 100 * (level + 1),
      },
      {
        key: 'tempering.vitality',
        name: '炼体·体魄',
        shortDesc: '升级后永久提升体魄',
        thresholdByLevel: (level: number) => 100 * (level + 1),
      },
      {
        key: 'tempering.spirit',
        name: '炼体·灵力',
        shortDesc: '升级后永久提升灵力',
        thresholdByLevel: (level: number) => 100 * (level + 1),
      },
      {
        key: 'tempering.wisdom',
        name: '炼体·悟性',
        shortDesc: '升级后永久提升悟性',
        thresholdByLevel: (level: number) => 100 * (level + 1),
      },
      {
        key: 'tempering.speed',
        name: '炼体·身法',
        shortDesc: '升级后永久提升身法',
        thresholdByLevel: (level: number) => 100 * (level + 1),
      },
      {
        key: 'tempering.willpower',
        name: '炼体·神识',
        shortDesc: '升级后永久提升神识',
        thresholdByLevel: (level: number) => 100 * (level + 1),
      },
    ]);

    mockUseCultivator.mockReturnValue({
      cultivator: {
        cultivation_progress: {
          cultivation_exp: 420,
          exp_cap: 1000,
          comprehension_insight: 37,
          breakthrough_failures: 0,
          bottleneck_state: false,
          inner_demon: false,
          deviation_risk: 0,
        },
        condition: {
          resources: {
            hp: { current: 80 },
            mp: { current: 40 },
          },
          gauges: {
            pillToxicity: 12,
          },
          statuses: [
            {
              key: 'blessing',
              duration: {
                kind: 'time',
                expiresAt: '2026-05-19T12:30:00.000Z',
              },
              usesRemaining: 2,
            },
          ],
          tracks: {
            marrowWash: {
              level: 2,
              progress: 40,
            },
            tempering: {
              vitality: {
                level: 1,
                progress: 20,
              },
              spirit: {
                level: 0,
                progress: 0,
              },
              wisdom: {
                level: 0,
                progress: 0,
              },
              speed: {
                level: 0,
                progress: 0,
              },
              willpower: {
                level: 0,
                progress: 0,
              },
            },
          },
        },
      },
      finalAttributes: {
        maxHp: 120,
        maxMp: 60,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders compact current-status content and a separate compact track section', () => {
    const html = renderToStaticMarkup(
      <>
        <CultivatorCurrentStatusSection />
        <CultivatorTrackSection />
      </>,
    );

    expect(html).toContain('当前状态');
    expect(html).toContain('气血');
    expect(html).toContain('80 / 120');
    expect(html).toContain('自然恢复每时约 9.6/小时');
    expect(html).toContain('约 4时10分回满');
    expect(html).toContain('法力');
    expect(html).toContain('40 / 60');
    expect(html).toContain('自然恢复约 10.8/小时');
    expect(html).toContain('约 1时52分回满');
    expect(html).toContain('丹毒');
    expect(html).toContain('12');
    expect(html).toContain('毒息未散');
    expect(html).toContain('恢复 93% · 破境压制 1.2%');
    expect(html).toContain('修为');
    expect(html).toContain('420 / 1000');
    expect(html).toContain('42%');
    expect(html).toContain('道心感悟');
    expect(html).toContain('37 / 100');
    expect(html).toContain('福缘护体');
    expect(html).toContain('30分');
    expect(html).toContain('2次');
    expect(html).toContain('查看情况');

    expect(html).toContain('洗髓与炼体');
    expect(html).toContain('洗髓');
    expect(html).toContain('Lv.2');
    expect(html).toContain('40 / 300');
    expect(html).toContain('升级后所有灵根各提升 1 点');
    expect(html.indexOf('洗髓')).toBeLessThan(html.indexOf('炼体·体魄'));
    expect(html).toContain('炼体·体魄');
    expect(html).toContain('Lv.1');
    expect(html).toContain('20 / 200');
    expect(html).toContain('升级后永久提升体魄');
    expect(html).toContain('炼体·灵力');
    expect(html).toContain('炼体·悟性');
    expect(html).toContain('炼体·身法');
    expect(html).toContain('炼体·神识');
    expect(html).toContain('0 / 100');
    expect(html.indexOf('炼体·体魄')).toBeLessThan(html.indexOf('炼体·灵力'));
    expect(html.indexOf('炼体·灵力')).toBeLessThan(html.indexOf('炼体·悟性'));
    expect(html.indexOf('炼体·悟性')).toBeLessThan(html.indexOf('炼体·身法'));
    expect(html.indexOf('炼体·身法')).toBeLessThan(html.indexOf('炼体·神识'));
  });

  it('keeps all six tracks visible even before any progress has been made', () => {
    mockUseCultivator.mockReturnValue({
      cultivator: {
        cultivation_progress: {
          cultivation_exp: 0,
          exp_cap: 100,
          comprehension_insight: 0,
          breakthrough_failures: 0,
          bottleneck_state: false,
          inner_demon: false,
          deviation_risk: 0,
        },
        condition: {
          resources: {
            hp: { current: 120 },
            mp: { current: 60 },
          },
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
          tracks: {
            marrowWash: {
              level: 0,
              progress: 0,
            },
            tempering: {
              vitality: {
                level: 0,
                progress: 0,
              },
              spirit: {
                level: 0,
                progress: 0,
              },
              wisdom: {
                level: 0,
                progress: 0,
              },
              speed: {
                level: 0,
                progress: 0,
              },
              willpower: {
                level: 0,
                progress: 0,
              },
            },
          },
        },
      },
      finalAttributes: {
        maxHp: 120,
        maxMp: 60,
      },
    });

    const html = renderToStaticMarkup(<CultivatorTrackSection />);

    expect(html).toContain('洗髓与炼体');
    expect(html).toContain('洗髓');
    expect(html).toContain('Lv.0');
    expect(html).toContain('0 / 100');
    expect(html).toContain('炼体·体魄');
    expect(html).toContain('炼体·灵力');
    expect(html).toContain('炼体·悟性');
    expect(html).toContain('炼体·身法');
    expect(html).toContain('炼体·神识');
  });

  it('keeps cultivation rows visible even when other current-state resources are full', () => {
    mockGetBreakthroughPenaltyPercent.mockReturnValue(0);
    mockGetPillToxicityRecoveryMultiplier.mockReturnValue(1);
    mockGetNaturalRecoveryEstimate.mockReturnValue({
      perHour: 0,
      timeToFullMs: 0,
      isFull: true,
    });
    mockUseCultivator.mockReturnValue({
      cultivator: {
        cultivation_progress: {
          cultivation_exp: 0,
          exp_cap: 100,
          comprehension_insight: 0,
          breakthrough_failures: 0,
          bottleneck_state: false,
          inner_demon: false,
          deviation_risk: 0,
        },
        condition: {
          resources: {
            hp: { current: 120 },
            mp: { current: 60 },
          },
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
          tracks: {
            marrowWash: {
              level: 0,
              progress: 0,
            },
            tempering: {
              vitality: {
                level: 0,
                progress: 0,
              },
              spirit: {
                level: 0,
                progress: 0,
              },
              wisdom: {
                level: 0,
                progress: 0,
              },
              speed: {
                level: 0,
                progress: 0,
              },
              willpower: {
                level: 0,
                progress: 0,
              },
            },
          },
        },
      },
      finalAttributes: {
        maxHp: 120,
        maxMp: 60,
      },
    });

    const html = renderToStaticMarkup(<CultivatorCurrentStatusSection />);

    expect(html).toContain('当前状态');
    expect(html).toContain('修为');
    expect(html).toContain('0 / 100');
    expect(html).toContain('0%');
    expect(html).toContain('道心感悟');
    expect(html).toContain('0 / 100');
  });

  it('hides the current-status section when resources are full, no status remains, and cultivation progress is missing', () => {
    mockGetBreakthroughPenaltyPercent.mockReturnValue(0);
    mockGetPillToxicityRecoveryMultiplier.mockReturnValue(1);
    mockGetNaturalRecoveryEstimate.mockReturnValue({
      perHour: 0,
      timeToFullMs: 0,
      isFull: true,
    });
    mockUseCultivator.mockReturnValue({
      cultivator: {
        condition: {
          resources: {
            hp: { current: 120 },
            mp: { current: 60 },
          },
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
          tracks: {
            marrowWash: {
              level: 0,
              progress: 0,
            },
            tempering: {
              vitality: {
                level: 0,
                progress: 0,
              },
              spirit: {
                level: 0,
                progress: 0,
              },
              wisdom: {
                level: 0,
                progress: 0,
              },
              speed: {
                level: 0,
                progress: 0,
              },
              willpower: {
                level: 0,
                progress: 0,
              },
            },
          },
        },
      },
      finalAttributes: {
        maxHp: 120,
        maxMp: 60,
      },
    });

    const html = renderToStaticMarkup(<CultivatorCurrentStatusSection />);

    expect(html).toBe('');
  });

  it('builds weakness effect details with the current stack penalty', () => {
    const details = getStatusEffectDetails({
      key: 'weakness',
      stacks: 3,
      source: 'battle',
      duration: { kind: 'until_removed' },
      createdAt: '2026-05-19T12:00:00.000Z',
      updatedAt: '2026-05-19T12:00:00.000Z',
    });

    expect(details[0]).toContain('当前 3 层');
    expect(details[0]).toContain('15%');
  });

  it('builds pill toxicity effect details from current derived penalties', () => {
    const details = getPillToxicityEffectDetails({
      version: 1,
      resources: {
        hp: { current: 80 },
        mp: { current: 40 },
      },
      gauges: {
        pillToxicity: 12,
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
      },
      statuses: [],
      timestamps: {},
    });

    expect(details[0]).toContain('毒息未散');
    expect(details[1]).toContain('12');
    expect(details[1]).toContain('93%');
    expect(details[2]).toContain('1.2%');
  });
});
