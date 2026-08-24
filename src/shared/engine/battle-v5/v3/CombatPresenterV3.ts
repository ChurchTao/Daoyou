import { CombatFactNarratorV3 } from './CombatFactNarratorV3';
import { CombatNarrativeCatalogV3 } from './CombatNarrativeCatalogV3';
import {
  combatAttributionKeyV3,
  CombatNarrativePolicyV3,
  type CombatNarrativeItemV3,
} from './CombatNarrativePolicyV3';
import { CombatSystemSourceV3 } from './origin';
import type {
  CombatFactV3,
  CombatLogPresentationModeV3,
  CombatSequenceV3,
  PresentedCombatSequenceV3,
  PresentedLogGroupV3,
  PresentedLogLineV3,
  PresentedLogPartV3,
} from './types';

const part = (
  text: string,
  kind: PresentedLogPartV3['kind'] = 'text',
  tone?: PresentedLogPartV3['tone'],
  emphasis?: PresentedLogPartV3['emphasis'],
): PresentedLogPartV3 => ({ text, kind, tone, emphasis });

interface DraftLogGroupV3 {
  id: string;
  attribution?: PresentedLogLineV3;
  lines: PresentedLogLineV3[];
}

/** 编排 Sequence 标题与连续来源组，不解释事实含义。 */
export class CombatPresenterV3 {
  private readonly policy: CombatNarrativePolicyV3;
  private readonly narrator: CombatFactNarratorV3;

  constructor(readonly mode: CombatLogPresentationModeV3) {
    const catalog = new CombatNarrativeCatalogV3();
    this.policy = new CombatNarrativePolicyV3(mode, catalog);
    this.narrator = new CombatFactNarratorV3(mode, catalog);
  }

  present(sequence: CombatSequenceV3): PresentedCombatSequenceV3 {
    const drafts: DraftLogGroupV3[] = [];
    for (const item of this.policy.select(sequence)) {
      const key = this.itemKey(item);
      let group = drafts[drafts.length - 1];
      if (!group || group.id !== key) {
        group = {
          id: key,
          attribution: this.attributionHeading(item, sequence),
          lines: [],
        };
        drafts.push(group);
      }
      group.lines.push(this.narrator.narrate(item));
    }
    return {
      id: sequence.id,
      heading: this.sequenceHeading(sequence),
      groups: drafts.map((group) => this.finalizeGroup(group)),
    };
  }

  format(sequence: CombatSequenceV3): string[] {
    const presentation = this.present(sequence);
    return [
      ...(presentation.heading ? [this.formatLine(presentation.heading)] : []),
      ...presentation.groups.flatMap((group) => this.formatGroup(group)),
    ];
  }

  formatAll(sequences: CombatSequenceV3[]): string[] {
    return sequences.flatMap((sequence) => this.format(sequence));
  }

  private formatLine(line: PresentedLogLineV3): string {
    return line.parts.map((entry) => entry.text).join('');
  }

  private formatGroup(group: PresentedLogGroupV3): string[] {
    switch (group.layout) {
      case 'root':
        return group.lines.map((line) => this.formatLine(line));
      case 'inline':
        return [this.formatLine(group.line)];
      case 'branch':
        return [
          this.formatLine(group.heading),
          ...group.lines.map((line) => this.formatLine(line)),
        ];
    }
  }

  private finalizeGroup(group: DraftLogGroupV3): PresentedLogGroupV3 {
    if (!group.attribution) {
      return { id: group.id, layout: 'root', lines: group.lines };
    }
    if (group.lines.length === 1) {
      const [line] = group.lines;
      const connective = line.attributionLink === 'context' ? '：' : '触发：';
      return {
        id: group.id,
        layout: 'inline',
        line: {
          ...line,
          parts: [
            ...group.attribution.parts,
            part(connective, 'text', 'secondary'),
            ...line.parts,
          ],
        },
      };
    }
    return {
      id: group.id,
      layout: 'branch',
      heading: {
        ...group.attribution,
        parts: [...group.attribution.parts, part('触发', 'text', 'secondary')],
      },
      lines: group.lines,
    };
  }

  private itemKey(item: CombatNarrativeItemV3): string {
    return item.kind === 'expired_statuses'
      ? `expired:${item.target.id}:${combatAttributionKeyV3(item.facts[0].origin)}:${item.facts[0].trace.resolutionId ?? 'none'}`
      : combatAttributionKeyV3(item.fact.origin);
  }

  private attributionHeading(
    item: CombatNarrativeItemV3,
    sequence: CombatSequenceV3,
  ): PresentedLogLineV3 | undefined {
    if (item.kind === 'expired_statuses') return undefined;
    const fact = item.fact;
    if (this.isActionAbility(fact, sequence)) return undefined;
    if (
      fact.origin.kind === 'system' &&
      fact.origin.carrier.id === CombatSystemSourceV3.ACTION_FLOW.id
    ) {
      return undefined;
    }
    if (fact.origin.kind === 'system') {
      return {
        role: 'trigger',
        parts: [part(`「${fact.origin.carrier.name}」`, 'status')],
      };
    }
    const carrierReference = {
      kind:
        fact.origin.carrier.kind === 'ability'
          ? ('ability' as const)
          : fact.origin.carrier.kind === 'buff'
            ? ('status' as const)
            : ('mechanic' as const),
      id: fact.origin.carrier.id,
      name: fact.origin.carrier.name,
    };
    if (fact.origin.owner.id === sequence.actor?.id) {
      return {
        role: 'trigger',
        parts: [
          {
            ...part(`「${fact.origin.carrier.name}」`, 'status'),
            reference: carrierReference,
          },
        ],
      };
    }
    return {
      role: 'trigger',
      parts: [
        part(`「${fact.origin.owner.name}」`, 'unit'),
        part('的', 'text', 'secondary'),
        {
          ...part(`「${fact.origin.carrier.name}」`, 'status'),
          reference: carrierReference,
        },
      ],
    };
  }

  private isActionAbility(
    fact: CombatFactV3,
    sequence: CombatSequenceV3,
  ): boolean {
    return (
      sequence.phase === 'action' &&
      !!sequence.actor &&
      !!sequence.ability &&
      fact.origin.kind === 'owned' &&
      fact.origin.owner.id === sequence.actor.id &&
      fact.origin.carrier.kind === 'ability' &&
      fact.origin.carrier.id === sequence.ability.id
    );
  }

  private sequenceHeading(
    sequence: CombatSequenceV3,
  ): PresentedLogLineV3 | undefined {
    if (sequence.phase === 'battle_init') {
      return { role: 'system', parts: [part('【战斗开始】')] };
    }
    if (sequence.phase === 'round_start') {
      return {
        role: 'system',
        parts: [part(`【第 ${sequence.turn} 回合】`, 'text', 'secondary')],
      };
    }
    if (sequence.phase === 'battle_end') {
      if (!sequence.actor) {
        throw new Error('Battle end sequence has no winner');
      }
      return {
        role: 'system',
        parts: [
          part('【战斗结束】'),
          part(`「${sequence.actor.name}」`, 'unit'),
          part('获胜！', 'text', 'fatal', 'strong'),
        ],
      };
    }
    if (sequence.phase === 'action' && sequence.actor) {
      return {
        role: 'header',
        parts: [
          part(`「${sequence.actor.name}」`, 'unit'),
          sequence.ability
            ? {
                ...part(
                  `施放《${sequence.ability.name}》`,
                  'ability',
                  'ability',
                ),
                reference: {
                  kind: 'ability',
                  id: sequence.ability.id,
                  name: sequence.ability.name,
                },
              }
            : part('采取行动'),
        ],
      };
    }
    return undefined;
  }
}
