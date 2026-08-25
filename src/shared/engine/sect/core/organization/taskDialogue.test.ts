import { describe, expect, it } from 'vitest';
import { StandardSectOrganizationModule } from './StandardSectOrganizationModule';
import { resolveSectTaskExecutionLocationParameters } from './contracts';
import { resolveSectTaskDialogue } from './taskDialogue';
import { createSectTaskOfferSnapshot } from './taskOffer';

function offer(args: {
  executorKey: string;
  requirement?: Parameters<
    typeof createSectTaskOfferSnapshot
  >[0]['requirement'];
}) {
  return createSectTaskOfferSnapshot({
    rulesVersion: 1,
    anchorRealm: '金丹',
    anchorRealmStage: '中期',
    periodKey: '2026-07-26',
    executorKey: args.executorKey,
    requirement: args.requirement,
    difficulty: 'hard',
  });
}

describe('sect task dialogue presentation', () => {
  it('resolves delivery requirements into semantic Chinese segments', () => {
    const definition = new StandardSectOrganizationModule().tasks.get(
      'pill_delivery',
    )!;
    const dialogue = resolveSectTaskDialogue({
      definition,
      offer: offer({
        executorKey: definition.executorKey,
        requirement: {
          kind: 'pill',
          quantity: 1,
          minQuality: '玄品',
          family: 'longevity',
          trait: 'increase_lifespan',
          appearance: { mode: 'at_least', grade: 'middle' },
        },
      }),
      progress: { current: 0, target: 1 },
    });
    const text = dialogue.instruction.map((segment) => segment.text).join('');

    expect(dialogue.offeredReply).toBe('丹房所需之物，我来寻');
    expect(text).toBe(
      '替丹房寻来1颗玄品以上、具有增加寿元功效的延寿丹，品相不可低于中品，取得后直接带回事务堂即可。',
    );
    expect(text).not.toMatch(/longevity|increase_lifespan|middle|_/);
  });

  it('speaks multi-step progress as a natural sentence', () => {
    const definition = new StandardSectOrganizationModule().tasks.get(
      'weekly_diligence',
    )!;
    const dialogue = resolveSectTaskDialogue({
      definition,
      offer: offer({
        executorKey: definition.executorKey,
      }),
      progress: { current: 2, target: 5 },
    });

    expect(dialogue.instruction.map((segment) => segment.text).join('')).toBe(
      '本周要完成五次宗门日常，功簿会逐次记下。 功簿上已经记下2次，还差3次。',
    );
  });

  it('keeps standard dialogue while applying non-task organization themes', () => {
    const definition = new StandardSectOrganizationModule({
      facilityNames: { archive: '宗门藏书阁' },
    }).tasks.get('dungeon_exploration')!;

    expect(definition.presentation.dialogue.offeredReply).toBe(
      '这桩秘境探索交给我吧',
    );
    expect(definition.presentation.dialogue.instruction.text).toBe(
      '领取委托后，从任务入口前往任意一处秘境，入境不消耗天地灵气；成功完成探索后再回事务堂交回回执。中途撤离不算完成。',
    );
  });

  it('assigns canonical execution locations to patrol and tournament tasks', () => {
    const tasks = new StandardSectOrganizationModule().tasks;
    expect(
      resolveSectTaskExecutionLocationParameters(tasks.get('mine_patrol')!),
    ).toEqual({
      executionLocation: {
        key: 'sect.spirit-vein',
        travelReply: '弟子这就前往矿场巡视',
      },
    });
    expect(
      resolveSectTaskExecutionLocationParameters(
        tasks.get('weekly_tournament')!,
      ),
    ).toEqual({
      executionLocation: {
        key: 'sect.arena',
        travelReply: '弟子这就去演武场候教',
      },
    });
    expect(
      resolveSectTaskExecutionLocationParameters(
        tasks.get('weekly_bounty_battle')!,
      ),
    ).toEqual({
      executionLocation: {
        key: 'sect.foreign-gate',
        travelReply: '弟子这就循悬赏前往目标宗门',
      },
    });
    expect(
      resolveSectTaskExecutionLocationParameters(
        tasks.get('weekly_bounty_material')!,
      ),
    ).toBeUndefined();
  });
});
