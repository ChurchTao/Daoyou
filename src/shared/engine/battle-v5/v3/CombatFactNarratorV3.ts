import { CombatNarrativeCatalogV3 } from './CombatNarrativeCatalogV3';
import type { CombatNarrativeItemV3 } from './CombatNarrativePolicyV3';
import type {
  CombatFactV3,
  CombatLogPresentationModeV3,
  PresentedLogLineV3,
  PresentedLogPartV3,
  PresentedLogToneV3,
} from './types';

type DamageFactV3 = Extract<CombatFactV3, { type: 'damage' }>;
type StatusFactV3 = Extract<CombatFactV3, { type: 'status' }>;

const DAMAGE_TONE: Record<DamageFactV3['damageType'], PresentedLogToneV3> = {
  physical: 'damage_physical',
  magical: 'damage_magical',
  true: 'damage_true',
  dot: 'damage_dot',
};

const STATUS_TONE: Record<StatusFactV3['statusType'], PresentedLogToneV3> = {
  buff: 'buff',
  debuff: 'debuff',
  control: 'control',
};

const part = (
  text: string,
  kind: PresentedLogPartV3['kind'] = 'text',
  tone?: PresentedLogPartV3['tone'],
  emphasis?: PresentedLogPartV3['emphasis'],
): PresentedLogPartV3 => ({ text, kind, tone, emphasis });

function isOwnedByTarget(fact: CombatFactV3): boolean {
  return (
    fact.origin.kind === 'owned' && fact.origin.owner.id === fact.target.id
  );
}

function durationText(duration: number): string {
  return duration === -1 ? '永久' : `${duration} 回合`;
}

export class CombatFactNarratorV3 {
  constructor(
    private readonly mode: CombatLogPresentationModeV3,
    private readonly catalog = new CombatNarrativeCatalogV3(),
  ) {}

  narrate(item: CombatNarrativeItemV3): PresentedLogLineV3 {
    if (item.kind === 'expired_statuses') {
      return {
        role: 'secondary',
        parts: [
          part(`「${item.target.name}」`, 'unit'),
          part('的状态结束：'),
          ...item.facts.flatMap((fact, index) => [
            ...(index > 0 ? [part('、')] : []),
            part(
              `「${fact.statusName}」`,
              'status',
              STATUS_TONE[fact.statusType],
            ),
          ]),
        ],
      };
    }

    const fact = item.fact;
    switch (fact.type) {
      case 'damage': {
        const damageTone = DAMAGE_TONE[fact.damageType];
        if (fact.amount === 0 && fact.shieldAbsorbed > 0) {
          return {
            role: fact.damageSource === 'direct' ? 'primary' : 'secondary',
            parts: [
              part('护盾吸收 '),
              part(String(fact.shieldAbsorbed), 'number', 'shield', 'strong'),
              part(` 点伤害，「${fact.target.name}」气血未损`, 'unit'),
              ...this.vitalDetail(fact.beforeHp, fact.afterHp),
            ],
          };
        }
        return {
          role: fact.damageSource === 'direct' ? 'primary' : 'secondary',
          parts: [
            part(`对「${fact.target.name}」造成 `),
            part(String(fact.amount), 'number', damageTone, 'strong'),
            part(' 点伤害'),
            ...(fact.critical
              ? [part('（暴击）', 'text', damageTone, 'strong')]
              : []),
            ...(fact.shieldAbsorbed > 0
              ? [
                  part('，护盾吸收 '),
                  part(String(fact.shieldAbsorbed), 'number', 'shield'),
                  part(' 点'),
                ]
              : []),
            ...this.vitalDetail(fact.beforeHp, fact.afterHp),
          ],
        };
      }
      case 'recovery':
        return {
          role: 'trigger',
          parts: [
            part(
              isOwnedByTarget(fact)
                ? '恢复 '
                : `为「${fact.target.name}」恢复 `,
            ),
            part(String(fact.amount), 'number', 'positive'),
            part(fact.resource === 'hp' ? ' 点气血' : ' 点法力'),
            ...(this.mode === 'detailed'
              ? [
                  part('，结算后'),
                  part(fact.resource === 'hp' ? '气血 ' : '法力 ', 'resource'),
                  part(String(fact.after), 'number', 'resource'),
                ]
              : []),
          ],
        };
      case 'shield':
        return {
          role: 'trigger',
          parts: [
            part(
              isOwnedByTarget(fact)
                ? '获得 '
                : `为「${fact.target.name}」提供 `,
            ),
            part(String(fact.amount), 'number', 'shield'),
            part(' 点护盾'),
            ...(this.mode === 'detailed'
              ? [
                  part('，结算后护盾 '),
                  part(String(fact.after), 'number', 'shield'),
                ]
              : []),
          ],
        };
      case 'status':
        return this.narrateStatus(fact);
      case 'defense':
        return this.narrateDefense(fact);
      case 'resource':
        return {
          role: 'resource',
          parts: [
            ...(!isOwnedByTarget(fact)
              ? [part(`「${fact.target.name}」的`, 'unit')]
              : []),
            part(fact.resourceName, 'resource'),
            part(' '),
            part(String(fact.before), 'number', 'resource'),
            part(' → '),
            part(String(fact.after), 'number', 'resource'),
          ],
        };
      case 'action_state':
        return this.narrateActionState(fact);
      case 'mechanic':
        return { role: 'trigger', ...this.catalog.narrate(fact) };
      case 'death_prevented':
        return {
          role: 'state',
          parts: [
            part(`「${fact.target.name}」`, 'unit'),
            part('免于死亡', 'text', 'defense', 'strong'),
          ],
        };
      case 'unit_died':
        return {
          role: 'state',
          parts: [
            part(`「${fact.target.name}」`, 'unit'),
            part('被击败！', 'text', 'fatal', 'strong'),
          ],
        };
    }
  }

  private narrateStatus(
    fact: Extract<CombatFactV3, { type: 'status' }>,
  ): PresentedLogLineV3 {
    if (fact.operation === 'immune') {
      return {
        role: 'trigger',
        parts: [
          part(`「${fact.target.name}」`, 'unit'),
          part('免疫', 'text', 'defense'),
          part(
            `「${fact.statusName}」`,
            'status',
            STATUS_TONE[fact.statusType],
          ),
        ],
      };
    }
    if (fact.operation === 'layers') {
      return {
        role: 'secondary',
        parts: [
          part(
            this.statusLayerText(fact),
            'status',
            STATUS_TONE[fact.statusType],
          ),
        ],
      };
    }
    if (fact.operation === 'remove') {
      const action = {
        expired: '结束',
        dispelled: '被驱散',
        consumed: '被消耗',
        replaced: '被替换',
        manual: '被移除',
      }[fact.reason];
      return {
        role: 'secondary',
        parts: [
          part(`「${fact.target.name}」的`, 'unit'),
          part(
            `「${fact.statusName}」`,
            'status',
            STATUS_TONE[fact.statusType],
          ),
          part(action),
          ...(this.mode === 'detailed'
            ? [
                part('（层数 '),
                part(String(fact.beforeLayers), 'number', 'secondary'),
                part(' → 0）'),
              ]
            : []),
        ],
      };
    }

    const selfTarget = isOwnedByTarget(fact);
    const targetPrefix = selfTarget ? '' : `对「${fact.target.name}」`;
    const ownedStatusPrefix = selfTarget ? '' : `「${fact.target.name}」的`;
    const suffix = `（${
      fact.afterLayers > 1 ? `${fact.afterLayers} 层，` : ''
    }${durationText(fact.duration)}）`;
    const text = {
      added: selfTarget
        ? `获得「${fact.statusName}」`
        : `${targetPrefix}施加「${fact.statusName}」`,
      stacked: `${ownedStatusPrefix}「${fact.statusName}」叠至 ${fact.afterLayers} 层`,
      refreshed: `刷新${ownedStatusPrefix}「${fact.statusName}」`,
      replaced: `${ownedStatusPrefix}状态替换为「${fact.statusName}」`,
    }[fact.transition];
    const detailedTransition =
      this.mode === 'detailed' && fact.transition !== 'added'
        ? `，层数 ${fact.beforeLayers} → ${fact.afterLayers}`
        : '';
    return {
      role: 'trigger',
      parts: [
        part(text, 'status', STATUS_TONE[fact.statusType]),
        part(`${suffix}${detailedTransition}`, 'text', 'secondary'),
      ],
    };
  }

  private narrateDefense(
    fact: Extract<CombatFactV3, { type: 'defense' }>,
  ): PresentedLogLineV3 {
    let parts: PresentedLogPartV3[];
    switch (fact.defense) {
      case 'mana_shield':
        parts = [part('法力护盾生效', 'status', 'shield')];
        if (fact.amount !== undefined) {
          parts.push(
            part('，抵消 '),
            part(String(fact.amount), 'number', 'shield'),
            part(' 点伤害'),
          );
        }
        break;
      case 'damage_immune':
        parts = [
          part(`「${fact.target.name}」`, 'unit'),
          part('免疫', 'text', 'defense'),
        ];
        if (fact.amount !== undefined) {
          parts.push(
            part(' '),
            part(String(fact.amount), 'number', 'defense'),
            part(' 点伤害'),
          );
        } else {
          parts.push(part('伤害', 'text', 'defense'));
        }
        break;
      case 'dodge':
        parts = [part('成功闪避', 'text', 'defense')];
        break;
      case 'resist':
        parts = [
          part(`「${fact.target.name}」`, 'unit'),
          part('抵抗控制', 'text', 'defense'),
        ];
        break;
      case 'interrupt':
        parts = [part('施法被打断', 'text', 'defense')];
        break;
      case 'skill_immune':
        parts = [part('技能被免疫', 'text', 'defense')];
        break;
    }
    if (fact.detail) {
      parts.push(part(`（${fact.detail}）`));
    }
    return { role: 'trigger', parts };
  }

  private narrateActionState(
    fact: Extract<CombatFactV3, { type: 'action_state' }>,
  ): PresentedLogLineV3 {
    if (fact.stateType === 'queued_action') {
      const text = {
        entered: `开始蓄势，下次行动施放《${fact.ability.name}》`,
        triggered: `蓄势完成，施放《${fact.ability.name}》`,
        cancelled: '蓄势被打断',
        skipped: '蓄势未能发动',
      }[fact.phase];
      return {
        role: 'state',
        parts: [
          part(text, 'text', 'control'),
          ...(this.mode === 'detailed'
            ? [
                part(
                  `（剩余行动 ${fact.remainingActions} 次）`,
                  'text',
                  'secondary',
                ),
              ]
            : []),
        ],
      };
    }
    if (fact.stateType === 'rest') {
      const text =
        fact.phase === 'entered'
          ? `进入「${fact.name}」，接下来 ${fact.remainingActions} 次行动无法出手`
          : fact.phase === 'skipped'
            ? `正在「${fact.name}」，本回合无法行动`
            : fact.phase === 'cancelled'
              ? `结束「${fact.name}」`
              : `完成「${fact.name}」`;
      return { role: 'state', parts: [part(text, 'text', 'control')] };
    }
    const text = {
      entered: `进入「${fact.name}」状态（可维持 ${fact.remainingActions} 次行动）`,
      triggered:
        fact.remainingActions > 0
          ? `「${fact.name}」还可维持 ${fact.remainingActions} 次行动`
          : `「${fact.name}」状态结束`,
      cancelled: `退出「${fact.name}」状态`,
      skipped: `「${fact.name}」未能生效`,
    }[fact.phase];
    return {
      role: 'state',
      parts: [part(text, 'status', 'mechanic')],
    };
  }

  private vitalDetail(before: number, after: number): PresentedLogPartV3[] {
    if (this.mode !== 'detailed') return [];
    return [
      part('（气血 '),
      part(String(before), 'number', 'secondary'),
      part(' → '),
      part(String(after), 'number', 'secondary'),
      part('）'),
    ];
  }

  private statusLayerText(
    fact: Extract<CombatFactV3, { type: 'status'; operation: 'layers' }>,
  ): string {
    const delta = Math.abs(fact.afterLayers - fact.beforeLayers);
    if (fact.reason === 'consumed') {
      return `消耗「${fact.statusName}」${delta} 层，剩余 ${fact.afterLayers} 层`;
    }
    if (fact.reason === 'dispelled') {
      return `驱散「${fact.statusName}」${delta} 层，剩余 ${fact.afterLayers} 层`;
    }
    if (fact.afterLayers > fact.beforeLayers && this.mode === 'concise') {
      return `「${fact.statusName}」叠至 ${fact.afterLayers} 层`;
    }
    return `「${fact.statusName}」层数 ${fact.beforeLayers} → ${fact.afterLayers}`;
  }
}
