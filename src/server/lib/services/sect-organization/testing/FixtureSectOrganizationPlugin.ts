import type { Material } from '@shared/types/cultivator';
import { z } from 'zod';
import { organizationError } from '../applicationSupport';
import type {
  SectDonationSpecification,
  SectRewardGrantStrategy,
} from '../EconomyStrategies';
import type { SectOrganizationPluginManifest } from '../SectOrganizationPlugins';
import { ContributionTaskSettlementStrategy } from '../SectTaskSettlement';
import type { SectTaskExecutor } from '../task-executors/SectTaskExecutor';

const fixtureInput = z.object({ pass: z.literal(true) });

const fixtureExecutor: SectTaskExecutor<z.infer<typeof fixtureInput>> = {
  key: 'fixture.battle',
  inputSchema: (actionKey) =>
    actionKey === 'finish' ? fixtureInput : z.never(),
  requiredCapability: (definition) => definition.requiredCapability,
  prepareAcceptance: (definition) => ({ target: definition.target }),
  actions: (definition) => [{
    key: 'finish',
    renderer: definition.presentation.renderer,
    label: definition.presentation.actionLabel,
  }],
  execute: async (_actionKey, _context, input) => ({
    completed: input.pass,
    outcome: { renderer: 'fixture.outcome', data: { pass: input.pass } },
  }),
};

class FixtureMaterialRewardStrategy implements SectRewardGrantStrategy {
  readonly key = 'fixture.material';

  async grant(context: Parameters<SectRewardGrantStrategy['grant']>[0]) {
    if (!context.grant.type || !context.grant.quality)
      organizationError('夹具材料奖励配置无效', 500);
    await context.rewards.grantMaterial(context.cultivatorId, {
      name: context.grant.name,
      type: context.grant.type,
      rank: context.grant.quality,
      element: context.grant.element as Material['element'],
      description: context.grant.description,
      details: { source: context.source },
      quantity: context.quantity,
    });
  }
}

class FixtureSpiritStoneDonation implements SectDonationSpecification {
  readonly key = 'fixture.spirit_stones';

  async consume(context: Parameters<SectDonationSpecification['consume']>[0]) {
    if (
      !(await context.economy.spendSpiritStones(
        context.cultivatorId,
        context.itemQuantity,
      ))
    )
      organizationError('灵石不足', 400);
    return {
      kind: this.key,
      units: context.units,
      amount: context.itemQuantity,
    };
  }
}

export const FIXTURE_SECT_ORGANIZATION_PLUGIN: SectOrganizationPluginManifest = {
  sectId: 'fixture-sect',
  executors: [() => fixtureExecutor],
  settlements: [
    () => new ContributionTaskSettlementStrategy(
      'fixture.settlement.contribution',
    ),
  ],
  rewardGrants: [() => new FixtureMaterialRewardStrategy()],
  donations: [() => new FixtureSpiritStoneDonation()],
};
