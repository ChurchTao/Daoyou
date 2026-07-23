import type {
  LogEntry,
  LogEntryType,
  LogSourceRef,
  LogSpan,
} from './types';

export interface ReducedActionLog {
  primaryEntries: LogEntry[];
  triggerEntries: LogEntry[];
  secondaryDamage: Array<LogEntry<'damage'>>;
  namedTriggers: Array<LogEntry<'mechanic'>>;
  statusTransitions: Array<LogEntry<'mechanic'>>;
  abilityModeStates: Array<LogEntry<'action_state'>>;
  deferredActionStates: Array<LogEntry<'action_state'>>;
  resourceEntries: Array<LogEntry<'resource_change'>>;
}

function findEntries<T extends LogEntryType>(
  entries: LogEntry[],
  type: T,
): LogEntry<T>[] {
  return entries.filter((entry) => entry.type === type) as LogEntry<T>[];
}

export function getLogEntrySource(
  entry: LogEntry,
): LogSourceRef | undefined {
  return (entry.data as { source?: LogSourceRef }).source;
}

function isPlayerVisibleEntry(entry: LogEntry): boolean {
  if (entry.type === 'buff_apply') {
    return (entry.data as LogEntry<'buff_apply'>['data']).visibility !== 'debug';
  }
  if (entry.type === 'mechanic') {
    const mechanic = entry.data as LogEntry<'mechanic'>['data'];
    return mechanic.visibility !== 'debug' && mechanic.mechanic !== 'buff_layer';
  }
  return true;
}

function coalesceBuffApplications(entries: LogEntry[]): LogEntry[] {
  const lastIndexByBuff = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (entry.type !== 'buff_apply') return;
    const data = entry.data as LogEntry<'buff_apply'>['data'];
    lastIndexByBuff.set(`${data.targetId}|${data.buffId}`, index);
  });

  return entries.filter((entry, index) => {
    if (entry.type !== 'buff_apply') return true;
    const data = entry.data as LogEntry<'buff_apply'>['data'];
    return lastIndexByBuff.get(`${data.targetId}|${data.buffId}`) === index;
  });
}

function isZeroOutcome(entry: LogEntry): boolean {
  if (
    entry.type === 'heal' ||
    entry.type === 'mana_burn' ||
    entry.type === 'resource_drain' ||
    entry.type === 'shield'
  ) {
    return (entry.data as { value: number }).value <= 0;
  }
  return false;
}

function isTriggeredOutcome(entry: LogEntry, span: LogSpan): boolean {
  const source = getLogEntrySource(entry);
  if (source?.buffId || source?.buffName) return true;
  return Boolean(
    source?.abilityId &&
      span.ability?.id &&
      source.abilityId !== span.ability.id,
  );
}

export function reduceActionLog(span: LogSpan): ReducedActionLog {
  const entries = coalesceBuffApplications(
    span.entries.filter(isPlayerVisibleEntry),
  );
  const resourceEntries = findEntries(entries, 'resource_change').filter(
    (entry) => !entry.data.isInitial,
  );
  const actionStateEntries = findEntries(entries, 'action_state');
  const abilityModeStates = actionStateEntries.filter(
    (entry) => entry.data.stateType === 'ability_mode',
  );
  const deferredActionStates = actionStateEntries.filter(
    (entry) => entry.data.stateType !== 'ability_mode',
  );
  const secondaryDamage = findEntries(entries, 'damage').filter(
    (entry) =>
      entry.data.damageSource === 'follow_up' ||
      entry.data.damageSource === 'counter' ||
      entry.data.damageSource === 'reflect' ||
      (entry.data.damageSource === 'delayed' && Boolean(entry.data.cause)),
  );
  const secondaryDamageIds = new Set(
    secondaryDamage.map((entry) => entry.id),
  );
  const namedTriggers = findEntries(entries, 'mechanic').filter(
    (entry) => entry.data.mechanic === 'named_trigger',
  );
  const statusTransitions = findEntries(entries, 'mechanic').filter(
    (entry) => entry.data.mechanic === 'status_transition',
  );
  const standaloneMechanicIds = new Set(
    [...namedTriggers, ...statusTransitions].map((entry) => entry.id),
  );
  const outcomeEntries = entries.filter(
    (entry) =>
      entry.type !== 'resource_change' &&
      entry.type !== 'action_state' &&
      !standaloneMechanicIds.has(entry.id) &&
      !(entry.type === 'damage' && secondaryDamageIds.has(entry.id)) &&
      !isZeroOutcome(entry),
  );
  const triggerEntries = outcomeEntries.filter((entry) =>
    isTriggeredOutcome(entry, span),
  );
  const primaryEntries = outcomeEntries.filter(
    (entry) => !triggerEntries.includes(entry),
  );

  return {
    primaryEntries,
    triggerEntries,
    secondaryDamage,
    namedTriggers,
    statusTransitions,
    abilityModeStates,
    deferredActionStates,
    resourceEntries,
  };
}
