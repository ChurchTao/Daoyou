import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { CombatSequenceV3 } from '../v3/types';
import type {
  CombatControlVisual,
  CombatImpactCue,
  CombatVisualActionInput,
  CombatVisualCommand,
  CombatVisualFact,
  CombatVisualSpec,
  CombatVisualTimeline,
} from './CombatVisualProtocol';

const CAST_DURATION = 940;
const REACTION_DURATION = 1_080;
const REACTION_GAP = 100;

const DELIVERY_TIMING: Record<
  CombatVisualSpec['delivery'],
  { duration: number; impactOffset: number }
> = {
  melee: { duration: 1_520, impactOffset: 660 },
  projectile: { duration: 1_080, impactOffset: 1_000 },
  beam: { duration: 760, impactOffset: 560 },
  field: { duration: 1_140, impactOffset: 820 },
  self: { duration: 720, impactOffset: 510 },
};

function factDuration(fact: CombatVisualFact) {
  switch (fact.kind) {
    case 'unit_died':
    case 'death_prevented':
      return 1_280;
    case 'mechanic':
    case 'action_state':
      return 1_020;
    default:
      return 860;
  }
}

interface ScheduledFact {
  fact: CombatVisualFact;
  at: number;
  timing: NonNullable<CombatVisualFact['timing']>;
}

interface ScheduledReaction {
  fact: CombatVisualFact;
  desiredAt: number;
  ordinal: number;
}

const DAMAGE_PRIORITY: Record<
  Extract<CombatImpactCue, { kind: 'damage' }>['damageType'],
  number
> = {
  physical: 0,
  dot: 1,
  magical: 2,
  true: 3,
};

function defenseCueLabel(
  defense: Extract<CombatVisualFact, { kind: 'defense' }>['defense'],
): Extract<CombatImpactCue, { kind: 'message' }>['label'] {
  switch (defense) {
    case 'dodge':
      return '闪避';
    case 'resist':
      return '抵抗';
    case 'interrupt':
      return '中断';
    case 'damage_immune':
    case 'mana_shield':
      return '免疫';
  }
}

function createImpactCueCommands(
  action: CombatVisualActionInput,
  scheduledFacts: ScheduledFact[],
): CombatVisualCommand[] {
  const cues: Array<{ at: number; cue: CombatImpactCue }> = [];
  const damageGroups = new Map<
    string,
    {
      at: number;
      sourceId: string;
      targetId: string;
      amount: number;
      shieldAbsorbed: number;
      damageType: Extract<CombatImpactCue, { kind: 'damage' }>['damageType'];
      critical: boolean;
    }
  >();
  const recoveryGroups = new Map<
    string,
    { at: number; sourceId: string; targetId: string; amount: number }
  >();
  const messageGroups = new Map<
    string,
    {
      at: number;
      sourceId: string;
      targetId: string;
      label: Extract<CombatImpactCue, { kind: 'message' }>['label'];
      tone: Extract<CombatImpactCue, { kind: 'message' }>['tone'];
    }
  >();

  for (const scheduled of scheduledFacts) {
    const { fact, at, timing } = scheduled;
    const sourceId = fact.sourceId ?? action.sourceId;
    for (const targetId of fact.targetIds) {
      if (fact.kind === 'damage') {
        const key = `${timing}:${sourceId}:${targetId}:damage`;
        const shieldAbsorbed = Math.max(0, fact.shieldAbsorbed ?? 0);
        const hpDamage = Math.max(
          0,
          fact.hpDamage ?? fact.amount - shieldAbsorbed,
        );
        const existing = damageGroups.get(key);
        if (existing) {
          existing.at = Math.min(existing.at, at);
          existing.amount += hpDamage;
          existing.shieldAbsorbed += shieldAbsorbed;
          existing.critical ||= Boolean(fact.critical);
          if (
            DAMAGE_PRIORITY[fact.damageType] >
            DAMAGE_PRIORITY[existing.damageType]
          ) {
            existing.damageType = fact.damageType;
          }
        } else {
          damageGroups.set(key, {
            at,
            sourceId,
            targetId,
            amount: hpDamage,
            shieldAbsorbed,
            damageType: fact.damageType,
            critical: Boolean(fact.critical),
          });
        }
        continue;
      }
      if (fact.kind === 'recovery' && fact.resource === 'hp') {
        const key = `${timing}:${sourceId}:${targetId}:recovery`;
        const existing = recoveryGroups.get(key);
        if (existing) {
          existing.at = Math.min(existing.at, at);
          existing.amount += fact.amount;
        } else {
          recoveryGroups.set(key, {
            at,
            sourceId,
            targetId,
            amount: fact.amount,
          });
        }
        continue;
      }

      let message:
        | {
            label: Extract<CombatImpactCue, { kind: 'message' }>['label'];
            tone: Extract<CombatImpactCue, { kind: 'message' }>['tone'];
          }
        | undefined;
      if (fact.kind === 'defense') {
        message = {
          label: defenseCueLabel(fact.defense),
          tone: 'defense',
        };
      } else if (fact.kind === 'status' && fact.operation === 'immune') {
        message = { label: '免疫', tone: 'defense' };
      } else if (fact.kind === 'death_prevented') {
        message = { label: '留命', tone: 'survival' };
      } else if (fact.kind === 'unit_died') {
        message = { label: '离阵', tone: 'neutral' };
      }
      if (message) {
        const key = `${targetId}:message:${message.label}`;
        const existing = messageGroups.get(key);
        if (!existing || at < existing.at) {
          messageGroups.set(key, { at, sourceId, targetId, ...message });
        }
      }
    }
  }

  for (const group of damageGroups.values()) {
    cues.push({
      at: group.at,
      cue: {
        id: `${action.id}:impact:${cues.length + 1}`,
        kind: 'damage',
        sourceId: group.sourceId,
        targetId: group.targetId,
        amount: group.amount,
        shieldAbsorbed: group.shieldAbsorbed,
        damageType: group.damageType,
        critical: group.critical,
      },
    });
  }
  for (const group of recoveryGroups.values()) {
    cues.push({
      at: group.at,
      cue: {
        id: `${action.id}:impact:${cues.length + 1}`,
        kind: 'recovery',
        sourceId: group.sourceId,
        targetId: group.targetId,
        amount: group.amount,
      },
    });
  }
  for (const group of messageGroups.values()) {
    cues.push({
      at: group.at,
      cue: {
        id: `${action.id}:impact:${cues.length + 1}`,
        kind: 'message',
        sourceId: group.sourceId,
        targetId: group.targetId,
        label: group.label,
        tone: group.tone,
      },
    });
  }

  return cues
    .sort((left, right) => left.at - right.at)
    .map(({ at, cue }) => ({
      id: cue.id,
      kind: 'impact_cue' as const,
      at,
      duration: 980,
      cue,
    }));
}

export function projectCombatVisualAction(
  action: CombatVisualActionInput,
): CombatVisualTimeline {
  const deliveryAt = CAST_DURATION;
  const deliveryTiming = DELIVERY_TIMING[action.visual.delivery];
  const impactAt = deliveryAt + deliveryTiming.impactOffset;
  const commands: CombatVisualCommand[] = [
    {
      id: `${action.id}:cast`,
      kind: 'cast',
      at: 0,
      duration: CAST_DURATION,
    },
    {
      id: `${action.id}:delivery`,
      kind: 'delivery',
      at: deliveryAt,
      duration: deliveryTiming.duration,
      impactAt,
    },
  ];

  let castIndex = 0;
  let impactIndex = 0;
  let afterIndex = 0;
  const scheduledFacts: ScheduledFact[] = [];
  const scheduledReactions: ScheduledReaction[] = [];
  const impactFacts = action.facts.filter(
    (fact) => (fact.timing ?? 'impact') === 'impact',
  ).length;

  for (const fact of action.facts) {
    const timing = fact.timing ?? 'impact';
    const at =
      timing === 'cast'
        ? 520 + castIndex++ * 220
        : timing === 'after'
          ? impactAt + impactFacts * 240 + 420 + afterIndex++ * 320
          : impactAt + impactIndex++ * 240;
    scheduledFacts.push({ fact, at, timing });

    if (fact.reaction) {
      scheduledReactions.push({
        fact,
        desiredAt: Math.max(deliveryAt, at - 320),
        ordinal: scheduledFacts.length - 1,
      });
    }
    commands.push({
      id: `${action.id}:${fact.id}:resolve`,
      kind: 'resolve',
      at,
      duration: factDuration(fact),
      fact,
    });
  }

  const reactionSourceAvailableAt = new Map<string, number>();
  const emittedReactions = new Set<string>();
  for (const scheduled of scheduledReactions.sort(
    (left, right) =>
      left.desiredAt - right.desiredAt || left.ordinal - right.ordinal,
  )) {
    const reaction = scheduled.fact.reaction;
    if (!reaction) continue;
    const dedupeKey = `${reaction.sourceId}\u0000${reaction.label}`;
    if (emittedReactions.has(dedupeKey)) continue;
    emittedReactions.add(dedupeKey);
    const at = Math.max(
      scheduled.desiredAt,
      reactionSourceAvailableAt.get(reaction.sourceId) ?? 0,
    );
    commands.push({
      id: `${action.id}:${scheduled.fact.id}:reaction`,
      kind: 'reaction',
      at,
      duration: REACTION_DURATION,
      fact: scheduled.fact,
    });
    reactionSourceAvailableAt.set(
      reaction.sourceId,
      at + REACTION_DURATION + REACTION_GAP,
    );
  }
  commands.push(...createImpactCueCommands(action, scheduledFacts));

  const lastResolveEnd = commands.reduce(
    (latest, command) =>
      command.kind === 'resolve'
        ? Math.max(latest, command.at + command.duration)
        : latest,
    0,
  );
  const deliveryEnd = deliveryAt + deliveryTiming.duration;
  const lastReactionEnd = commands.reduce(
    (latest, command) =>
      command.kind === 'reaction'
        ? Math.max(latest, command.at + command.duration)
        : latest,
    0,
  );
  const settleAt = Math.max(deliveryEnd, lastResolveEnd, lastReactionEnd) + 620;
  commands.push({
    id: `${action.id}:settle`,
    kind: 'settle',
    at: settleAt,
    duration: 360,
  });
  commands.sort((left, right) => left.at - right.at);

  return {
    action,
    duration: settleAt + 360,
    impactAt,
    commands,
  };
}

function mechanicDisplayName(
  fact: Extract<CombatSequenceV3['facts'][number], { type: 'mechanic' }>,
) {
  const payload = fact.payload;
  switch (payload.kind) {
    case 'ability_lock':
      return `封术 · ${payload.abilityName}`;
    case 'tag_trigger':
    case 'named_trigger':
      return payload.label;
    case 'hp_sacrifice':
      return '燃血';
    case 'damage_defer':
      return '缓劫';
    case 'mana_burn':
      return '焚元';
    case 'cooldown_change':
      return `转息 · ${payload.abilityName}`;
    case 'memory_record':
      return '留痕';
    case 'memory_release':
      return '释痕';
    case 'control_skip':
      return payload.controlName;
    case 'status_transition':
      return payload.label;
    case 'ability_transform':
      return '术式转化';
  }
}

function inferControlVisual(statusId: string): CombatControlVisual {
  switch (statusId) {
    case GameplayTags.STATUS.CONTROL.STUNNED:
    case GameplayTags.STATUS.CONTROL.NO_ACTION:
      return 'stun';
    case GameplayTags.STATUS.CONTROL.NO_SKILL:
    case GameplayTags.STATUS.CONTROL.NO_BASIC:
      return 'bind';
    case GameplayTags.STATUS.STATE.FROZEN:
      return 'freeze';
    default:
      return 'generic';
  }
}

function adaptFact(
  fact: CombatSequenceV3['facts'][number],
  actionSourceId: string,
  actionAbilityId: string,
): CombatVisualFact {
  const base = {
    id: fact.id,
    sourceId:
      fact.origin.kind === 'owned' ? fact.origin.owner.id : actionSourceId,
    targetIds: [fact.target.id],
  };
  const ownedSourceId =
    fact.origin.kind === 'owned' ? fact.origin.owner.id : undefined;
  const isSecondaryCarrier =
    fact.origin.kind === 'owned' && fact.origin.carrier.id !== actionAbilityId;
  const reaction =
    ownedSourceId && (ownedSourceId !== actionSourceId || isSecondaryCarrier)
      ? {
          sourceId: ownedSourceId,
          label: fact.origin.carrier.name,
        }
      : undefined;

  switch (fact.type) {
    case 'damage':
      return {
        ...base,
        kind: 'damage',
        amount: fact.amount,
        hpDamage: Math.max(0, fact.beforeHp - fact.afterHp),
        damageType: fact.damageType,
        damageSource: fact.damageSource,
        critical: fact.critical,
        shieldAbsorbed: fact.shieldAbsorbed,
        reaction,
      };
    case 'recovery':
      return {
        ...base,
        kind: 'recovery',
        resource: fact.resource,
        amount: fact.amount,
        reaction,
      };
    case 'shield':
      return {
        ...base,
        kind: 'shield',
        operation: 'gain',
        amount: fact.amount,
        reaction,
      };
    case 'status':
      return {
        ...base,
        kind: 'status',
        operation: fact.operation,
        statusId: fact.statusId,
        statusName: fact.statusName,
        statusType: fact.statusType,
        controlVisual:
          fact.statusType === 'control'
            ? inferControlVisual(fact.statusId)
            : undefined,
        layers: fact.operation === 'immune' ? undefined : fact.afterLayers,
        durationMs:
          fact.operation === 'apply' && fact.duration >= 0
            ? fact.duration * 1_000
            : undefined,
        reaction,
      };
    case 'defense':
      return {
        ...base,
        kind: 'defense',
        defense: fact.defense,
        amount: fact.amount,
        detail: fact.detail,
        reaction,
      };
    case 'resource':
      return {
        ...base,
        kind: 'resource',
        resourceId: fact.resourceId,
        resourceName: fact.resourceName,
        before: fact.before,
        after: fact.after,
        max: fact.max,
        reaction,
      };
    case 'action_state':
      return {
        ...base,
        kind: 'action_state',
        stateType: fact.stateType,
        phase: fact.phase,
        stateName: fact.name,
        reaction,
      };
    case 'mechanic':
      return {
        ...base,
        kind: 'mechanic',
        mechanic: fact.payload.kind,
        displayName: mechanicDisplayName(fact),
        amount:
          'amount' in fact.payload && typeof fact.payload.amount === 'number'
            ? fact.payload.amount
            : undefined,
        reaction,
      };
    case 'death_prevented':
      return {
        ...base,
        kind: 'death_prevented',
        sourceName: fact.sourceName,
        reaction,
      };
    case 'unit_died':
      return { ...base, kind: 'unit_died', reaction };
  }
}

function inferFallbackVisual(
  sequence: CombatSequenceV3,
  sourceId: string,
  targetIds: string[],
): CombatVisualSpec {
  const damage = sequence.facts.find((fact) => fact.type === 'damage');
  const selfOnly =
    targetIds.length > 0 &&
    targetIds.every((targetId) => targetId === sourceId);
  if (selfOnly) {
    return {
      discipline: 'spell',
      delivery: 'self',
      distribution: 'single',
      weight: 'normal',
    };
  }
  if (targetIds.length > 1) {
    const physical = damage?.type === 'damage' && damage.damageType === 'physical';
    return {
      discipline:
        physical
          ? 'physical'
          : damage?.type === 'damage' && damage.damageType === 'true'
            ? 'true'
            : 'spell',
      delivery: physical ? 'melee' : 'projectile',
      distribution: 'fanout',
      weight: 'heavy',
    };
  }
  if (damage?.type === 'damage' && damage.damageType === 'physical') {
    return { discipline: 'physical', delivery: 'melee', weight: 'normal' };
  }
  if (damage?.type === 'damage' && damage.damageType === 'true') {
    return {
      discipline: 'true',
      delivery: 'beam',
      distribution: 'single',
      weight: 'heavy',
    };
  }
  return {
    discipline: 'spell',
    delivery: 'projectile',
    distribution: 'single',
    weight: 'normal',
  };
}

function hasDirectPhysicalDelivery(
  sequence: CombatSequenceV3,
  sourceId: string,
  abilityId: string,
) {
  if (sequence.phase !== 'action') return false;
  return sequence.facts.some((fact) =>
    fact.type === 'damage'
    && fact.damageType === 'physical'
    && (fact.damageSource === undefined || fact.damageSource === 'direct')
    && fact.target.id !== sourceId
    && fact.origin.kind === 'owned'
    && fact.origin.owner.id === sourceId
    && fact.origin.carrier.kind === 'ability'
    && fact.origin.carrier.id === abilityId,
  );
}

export function adaptCombatSequenceV3ToVisualAction(
  sequence: CombatSequenceV3,
  resolveVisual?: (sequence: CombatSequenceV3) => CombatVisualSpec | undefined,
): CombatVisualActionInput | null {
  const ownedFact = sequence.facts.find((fact) => fact.origin.kind === 'owned');
  const firstFact = sequence.facts[0];
  const sourceId =
    sequence.actor?.id ??
    (ownedFact?.origin.kind === 'owned'
      ? ownedFact.origin.owner.id
      : firstFact?.target.id);
  const ability =
    sequence.ability ??
    (firstFact
      ? {
          id: firstFact.origin.carrier.id,
          name: firstFact.origin.carrier.name,
        }
      : undefined);
  if (!sourceId || !ability) return null;

  const targetIds = Array.from(
    new Set(sequence.facts.map((fact) => fact.target.id)),
  );
  const facts = sequence.facts.map((fact) =>
    adaptFact(fact, sourceId, ability.id),
  );
  const authoredVisual =
    resolveVisual?.(sequence) ??
    inferFallbackVisual(sequence, sourceId, targetIds);
  const resolvedVisual = hasDirectPhysicalDelivery(sequence, sourceId, ability.id)
    ? { ...authoredVisual, discipline: 'physical' as const, delivery: 'melee' as const }
    : authoredVisual;
  return {
    id: sequence.id,
    sourceId,
    targetIds,
    ability,
    visual: {
      ...resolvedVisual,
      distribution:
        resolvedVisual.distribution ??
        (resolvedVisual.delivery === 'field'
          ? 'area'
          : targetIds.length > 1
            ? 'fanout'
            : 'single'),
    },
    facts,
  };
}
