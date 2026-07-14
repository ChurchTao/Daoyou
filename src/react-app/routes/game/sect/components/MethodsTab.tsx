import { SectAbilityDetails } from '@app/components/feature/sect/SectAbilityDetails';
import {
  InkButton,
  InkCard,
  InkDetailDrawer,
  InkNotice,
} from '@app/components/ui';
import { useCultivatorCurrency } from '@app/lib/player-state/selectors';
import type { SectCurrentData } from '@shared/contracts/sect';
import {
  describeMethodBenefit,
  getSectMethodTrainingCost,
  resolveMethodMilestones,
  type SectAbilityRole,
  type SectHeartMethodDefinition,
} from '@shared/engine/sect';
import { resolveSectAbility } from '@shared/engine/sect/content';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { useState } from 'react';
import { sectJsonRequest, type SectAction } from './types';

const roleLabels: Record<SectAbilityRole, string> = {
  generator: '积蓄',
  combo: '连段',
  defensive: '防守',
  finisher: '收束',
  utility: '辅助',
};

function getMethodDisabledReason(args: {
  method: SectHeartMethodDefinition;
  currentLevel: number;
  data: SectCurrentData;
  spiritStones: number;
  cost: { contribution: number; spiritStones: number };
}) {
  const targetLevel = args.currentLevel + 1;
  if (targetLevel > args.data.methodLevelCap) return '已达当前境界上限';
  const primary = args.data.definition?.methods.find(
    (method) => method.isPrimary,
  );
  if (
    primary &&
    args.method.id !== primary.id &&
    targetLevel > (args.data.sect?.methods[primary.id] ?? 0)
  ) {
    return `分卷不可超过${primary.name}`;
  }
  if ((args.data.sect?.contribution ?? 0) < args.cost.contribution)
    return '宗门贡献不足';
  if (args.spiritStones < args.cost.spiritStones) return '灵石不足';
  return undefined;
}

export function MethodsTab({
  data,
  busy,
  action,
  realm,
  stage,
}: {
  data: SectCurrentData;
  busy: boolean;
  action: SectAction;
  realm: RealmType;
  stage: RealmStage;
}) {
  const currency = useCultivatorCurrency();
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  if (!data.sect || !data.definition)
    return <InkNotice>拜师后方可研习宗门心法。</InkNotice>;
  const sect = data.sect;
  const definition = data.definition;
  const spiritStones = currency?.spiritStones ?? 0;
  const selectedMethod = selectedMethodId
    ? definition.methods.find((method) => method.id === selectedMethodId)
    : undefined;
  const selectedLevel = selectedMethod
    ? (sect.methods[selectedMethod.id] ?? 0)
    : 0;
  const selectedTarget = selectedLevel + 1;
  const selectedCost = getSectMethodTrainingCost(selectedLevel, selectedTarget);
  const selectedDisabledReason = selectedMethod
    ? getMethodDisabledReason({
        method: selectedMethod,
        currentLevel: selectedLevel,
        data,
        spiritStones,
        cost: selectedCost,
      })
    : undefined;
  const selectedMilestones = selectedMethod
    ? resolveMethodMilestones({
        definition,
        methodId: selectedMethod.id,
        sect,
        realm,
        stage,
      })
    : [];

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {definition.methods.map((method) => {
          const level = sect.methods[method.id] ?? 0;
          return (
            <InkCard key={method.id} padding="none">
              <button
                type="button"
                className="hover:bg-ink/4 w-full p-3 text-left transition-colors"
                onClick={() => setSelectedMethodId(method.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <strong>{method.name}</strong>
                  <span className="text-crimson shrink-0 text-sm">
                    {level} / {data.methodLevelCap}级
                  </span>
                </div>
                <p className="text-ink-secondary mt-2 text-sm leading-6">
                  {method.description}
                </p>
              </button>
            </InkCard>
          );
        })}
      </div>

      <InkDetailDrawer
        isOpen={Boolean(selectedMethod)}
        onClose={() => setSelectedMethodId(null)}
        title={selectedMethod?.name ?? '心法详情'}
        footer={
          selectedMethod ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm leading-6">
                <p>
                  本次：{selectedCost.contribution}贡献 ·{' '}
                  {selectedCost.spiritStones}灵石
                </p>
                <p className="text-ink-secondary">
                  持有：{sect.contribution}贡献 · {spiritStones}灵石
                </p>
                {selectedDisabledReason ? (
                  <p className="text-crimson">{selectedDisabledReason}</p>
                ) : null}
              </div>
              <InkButton
                variant="primary"
                disabled={busy || Boolean(selectedDisabledReason)}
                onClick={() =>
                  void action(
                    `/api/sects/current/methods/${selectedMethod.id}/train`,
                    sectJsonRequest('POST', { targetLevel: selectedTarget }),
                  )
                }
              >
                {busy ? '研习中' : '研习一级'}
              </InkButton>
            </div>
          ) : undefined
        }
      >
        {selectedMethod ? (
          <div className="space-y-4">
            <section>
              <p className="text-sm leading-7">{selectedMethod.description}</p>
              <div className="bg-ink/5 mt-3 p-3 text-sm leading-6">
                <p>
                  当前等级：{selectedLevel} / {data.methodLevelCap}级
                </p>
                <p>
                  每级收益：
                  {selectedMethod.perLevelDescription ?? '提升宗门修习资格。'}
                </p>
                <p className="text-crimson">
                  当前累计：
                  {describeMethodBenefit(selectedMethod, selectedLevel)}
                </p>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-base font-semibold">修炼节点与神通</h3>
              <div className="space-y-3">
                {selectedMilestones.map((milestone) => {
                  const abilityDefinition = milestone.abilityId
                    ? definition.abilities.find(
                        (ability) => ability.id === milestone.abilityId,
                      )
                    : undefined;
                  const abilityDetail = milestone.abilityId
                    ? resolveSectAbility({
                        abilityId: milestone.abilityId,
                        sect,
                        realm,
                      })
                    : undefined;
                  const stateLabel =
                    milestone.status === 'unlocked'
                      ? '已解锁'
                      : milestone.status === 'next'
                        ? '下一节点'
                        : '尚未达到';
                  return (
                    <div
                      key={milestone.id}
                      className="border-ink/15 border-b border-dashed pb-3 text-sm leading-6 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>
                          {milestone.level}级 ·{' '}
                          {abilityDetail?.name ?? milestone.name}
                        </strong>
                        <span
                          className={
                            milestone.status === 'unlocked'
                              ? 'text-crimson'
                              : 'text-ink-secondary'
                          }
                        >
                          {stateLabel}
                        </span>
                      </div>
                      <p>{milestone.description}</p>
                      {abilityDefinition ? (
                        <p className="text-ink-secondary">
                          定位：{roleLabels[abilityDefinition.role]} ·{' '}
                          {abilityDefinition.description}
                        </p>
                      ) : null}
                      {milestone.missingRequirements.length ? (
                        <p className="text-ink-secondary">
                          尚需：{milestone.missingRequirements.join('、')}
                        </p>
                      ) : null}
                      {abilityDetail ? (
                        <SectAbilityDetails
                          detail={abilityDetail}
                          collapsible={false}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
      </InkDetailDrawer>
    </>
  );
}
