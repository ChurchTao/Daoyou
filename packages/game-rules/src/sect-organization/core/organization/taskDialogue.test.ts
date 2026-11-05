import { describe, expect, it } from 'vitest';
import { StandardSectOrganizationModule } from './StandardSectOrganizationModule.js';
import { resolveSectTaskExecutionLocationParameters } from '@daoyou/game-domain/sects/commands';
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

    expect(dialogue.offeredReply).toBe(definition.presentation.dialogue.offeredReply);
    expect(dialogue.instruction.map((segment) => segment.emphasis)).toEqual(
      expect.arrayContaining(['quantity', 'quality', 'effect', 'appearance']),
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

    expect(dialogue.instruction.at(-1)?.text).toMatch(/2[^0-9]+3/u);
  });

  it('assigns canonical execution locations to patrol and tournament tasks', () => {
    const tasks = new StandardSectOrganizationModule().tasks;
    expect(
      resolveSectTaskExecutionLocationParameters(tasks.get('mine_patrol')!),
    ).toMatchObject({
      executionLocation: {
        key: 'sect.spirit-vein',
      },
    });
    expect(
      resolveSectTaskExecutionLocationParameters(
        tasks.get('weekly_tournament')!,
      ),
    ).toMatchObject({
      executionLocation: {
        key: 'sect.arena',
      },
    });
    expect(
      resolveSectTaskExecutionLocationParameters(
        tasks.get('weekly_bounty_battle')!,
      ),
    ).toMatchObject({
      executionLocation: {
        key: 'sect.foreign-gate',
      },
    });
    expect(
      resolveSectTaskExecutionLocationParameters(
        tasks.get('weekly_bounty_material')!,
      ),
    ).toBeUndefined();
  });
});
