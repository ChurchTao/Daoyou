import { describe, expect, it } from 'vitest';
import { StandardSectOrganizationModule } from './StandardSectOrganizationModule.js';
import { resolveSectTaskExecutionLocationParameters } from './contracts.js';
import { resolveSectTaskDialogue } from './taskDialogue.js';
import { createSectTaskOfferSnapshot } from './taskOffer.js';

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
    }).tasks.get('gate_sweep')!;

    expect(definition.presentation.dialogue.offeredReply).toBe(
      '山门洒扫便交给我吧',
    );
    expect(definition.presentation.dialogue.instruction.text).toBe(
      '去山门步道清理落叶，完成一轮洒扫后回来复命。',
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
