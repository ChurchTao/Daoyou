import { describe, expect, it } from 'vitest';
import { resolveSectPresentation } from './sectPresentation.js';
import type { SectPresentationTheme } from '@daoyou/game-domain/sects';

describe('sect presentation affairs room', () => {
  it('provides one default NPC for every task kind', () => {
    const presentation = resolveSectPresentation('sample-sect');
    expect(
      presentation.rooms.affairs.actors.map((actor) => actor.roleKey),
    ).toEqual(['daily', 'weekly', 'promotion']);
  });

  it('resolves managed rooms without allowing role or renderer overrides', () => {
    const unsafeTheme = {
      sectId: 'sample-sect',
      rooms: {
        spiritVein: {
          description: '地脉静室。',
          actors: {
            keeper: {
              id: 'sample-vein-keeper',
              name: '听脉人',
              greeting: '今日脉息安稳。',
              sigil: '矿',
              identity: '矿场主人',
              responsibility: '负责开采。',
              conversation: { renderer: 'unsafe.renderer' },
            },
            facility: {
              id: 'sample-spirit-vein',
              name: '坤元地脉',
              greeting: '地脉沉静。',
              sigil: '矿',
              appearance: 'person',
              conversation: { renderer: 'unsafe.facility-renderer' },
            },
          },
        },
      },
    } as unknown as SectPresentationTheme;
    const presentation = resolveSectPresentation('sample-sect', unsafeTheme);
    const actor = presentation.rooms.spiritVein.actors[0];
    const defaults = resolveSectPresentation('sample-sect').rooms.spiritVein.actors;

    expect(presentation.rooms.spiritVein.description).toBe('地脉静室。');
    expect(actor).toMatchObject({
      id: 'sample-vein-keeper',
      name: '听脉人',
      greeting: '今日脉息安稳。',
      sigil: defaults[0].sigil,
      appearance: 'person',
      identity: defaults[0].identity,
      responsibility: defaults[0].responsibility,
      conversation: { renderer: 'sect.spirit-vein.patrol' },
    });
    expect(presentation.rooms.spiritVein.actors[1]).toMatchObject({
      id: 'sample-spirit-vein',
      name: '坤元地脉',
      greeting: '地脉沉静。',
      sigil: defaults[1].sigil,
      appearance: 'facility',
      identity: defaults[1].identity,
      responsibility: defaults[1].responsibility,
      conversation: { renderer: 'sect.spirit-vein.mining' },
    });
  });

  it('models gate, spirit vein and herb garden facilities as display variants of NPCs', () => {
    const presentation = resolveSectPresentation('sample-sect', {
      sectId: 'sample-sect',
      rooms: {
        gate: {
          actors: {
            facility: { name: '观象门', greeting: '云气正在门前散去。' },
          },
        },
        spiritVein: {
          actors: {
            facility: { name: '坤元地脉', greeting: '地脉灵辉稳定。' },
          },
        },
        herbGarden: {
          actors: {
            facility: { name: '长生圃', greeting: '灵草依时生长。' },
          },
        },
      },
    });

    expect(
      presentation.rooms.gate.actors.map((actor) => [
        actor.roleKey,
        actor.appearance,
        actor.conversation.renderer,
      ]),
    ).toEqual([
      ['keeper', 'person', 'sect.gate.news'],
      ['facility', 'facility', 'sect.gate.sweep'],
    ]);
    expect(
      presentation.rooms.spiritVein.actors.find(
        (actor) => actor.roleKey === 'facility',
      ),
    ).toMatchObject({
      name: '坤元地脉',
      appearance: 'facility',
      conversation: { renderer: 'sect.spirit-vein.mining' },
    });
    expect(
      presentation.rooms.herbGarden.actors.find(
        (actor) => actor.roleKey === 'facility',
      ),
    ).toMatchObject({
      name: '长生圃',
      appearance: 'facility',
      conversation: { renderer: 'sect.herb-garden.status' },
    });
  });

  it('rejects unknown managed rooms, roles and duplicate actor identifiers', () => {
    expect(() =>
      resolveSectPresentation('sample-sect', {
        sectId: 'sample-sect',
        rooms: { unknown: { description: '未知房间。' } },
      }),
    ).toThrow('未知房间');
    expect(() =>
      resolveSectPresentation('sample-sect', {
        sectId: 'sample-sect',
        rooms: {
          hall: {
            actors: { unknown: { name: '无名' } },
          },
        },
      }),
    ).toThrow('未知角色');
    expect(() =>
      resolveSectPresentation('sample-sect', {
        sectId: 'sample-sect',
        rooms: {
          hall: {
            actors: {
              registry: { id: 'same' },
              stipend: { id: 'same' },
            },
          },
        },
      }),
    ).toThrow('NPC ID 不可重复');
    expect(() =>
      resolveSectPresentation('sample-sect', {
        sectId: 'sample-sect',
        rooms: {
          gate: {
            actors: {
              facility: { id: 'keeper' },
            },
          },
        },
      }),
    ).toThrow('NPC ID 不可重复');
  });

  it('merges sect-specific room and NPC copy with the defaults', () => {
    const presentation = resolveSectPresentation('sample-sect', {
      sectId: 'sample-sect',
      rooms: {
        affairs: {
          description: '星轨交汇之处，诸般事务各归其席。',
          actors: {
            daily: {
              name: '司辰使',
              greeting: '今日星轨已经排定。',
            },
          },
        },
      },
    });
    const actorByRole = Object.fromEntries(
      presentation.rooms.affairs.actors.map((actor) => [actor.roleKey, actor]),
    );

    expect(presentation.rooms.affairs.description).toBe(
      '星轨交汇之处，诸般事务各归其席。',
    );
    expect(actorByRole.daily).toMatchObject({
      id: 'daily-steward',
      name: '司辰使',
      greeting: '今日星轨已经排定。',
    });
    const defaultWeekly = resolveSectPresentation('sample-sect')
      .rooms.affairs.actors.find((actor) => actor.roleKey === 'weekly');
    expect(actorByRole.weekly).toEqual(defaultWeekly);
  });

  it('ignores runtime attempts to override canonical NPC role fields', () => {
    const unsafeTheme = {
      sectId: 'sample-sect',
      rooms: {
        affairs: {
          actors: {
            daily: {
              name: '司辰使',
              sigil: '辰',
              identity: '当值算使',
              responsibility: '负责校正地刻。',
            },
          },
        },
      },
      terms: {
        sweepActivity: '校正地刻',
        sweepCanvasLabel: '校正地刻游戏画布',
      },
    } as unknown as SectPresentationTheme;
    const presentation = resolveSectPresentation('sample-sect', unsafeTheme);
    const dailyActor = presentation.rooms.affairs.actors.find(
      (actor) => actor.roleKey === 'daily',
    );

    const defaults = resolveSectPresentation('sample-sect');
    const defaultDaily = defaults.rooms.affairs.actors.find(
      (actor) => actor.roleKey === 'daily',
    )!;
    expect(dailyActor).toMatchObject({
      name: '司辰使',
      sigil: defaultDaily.sigil,
      identity: defaultDaily.identity,
      responsibility: defaultDaily.responsibility,
      appearance: defaultDaily.appearance,
    });
    expect(presentation.terms).toEqual(defaults.terms);
  });

  it('rejects blank fields and duplicate NPC identifiers', () => {
    expect(() =>
      resolveSectPresentation('sample-sect', {
        sectId: 'sample-sect',
        rooms: {
          affairs: { actors: { daily: { greeting: ' ' } } },
        },
      }),
    ).toThrow('daily.greeting');

    const duplicateIds: SectPresentationTheme = {
      sectId: 'sample-sect',
      announcement: '测试公告',
      rooms: {
        affairs: {
          actors: {
            daily: { id: 'same-steward' },
            weekly: { id: 'same-steward' },
          },
        },
      },
    };
    expect(() => resolveSectPresentation('sample-sect', duplicateIds)).toThrow(
      'NPC ID 不可重复',
    );
  });
});
