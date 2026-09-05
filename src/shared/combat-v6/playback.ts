import type {
  CombatV6DeltaFrameV1,
  CombatV6OptionalUnitField,
  CombatV6UnitChanges,
  CombatV6TrainingUnitViewV1 as Unit,
} from '../contracts/combatV6';

const fields = [
  'name',
  'side',
  'slot',
  'kind',
  'ownerId',
  'attributes',
  'hp',
  'maxHp',
  'mp',
  'maxMp',
  'wound',
  'downed',
  'dead',
  'escaped',
  'statuses',
  'barriers',
  'resources',
] as const;

/** Public display values only. Arrays are replaced, numeric values are absolute. */
export function diffUnits(
  before: Unit[],
  after: Unit[],
  afterEventSeq: number,
  round: number,
): CombatV6DeltaFrameV1 {
  const previous = new Map(before.map((u) => [u.id, u]));
  const frame: CombatV6DeltaFrameV1 = { afterEventSeq, round, updates: [] };
  for (const unit of after) {
    const old = previous.get(unit.id);
    previous.delete(unit.id);
    if (!old) {
      (frame.added ??= []).push(unit);
      continue;
    }
    const set: CombatV6UnitChanges = {};
    const unset: CombatV6OptionalUnitField[] = [];
    for (const key of fields) {
      if (Object.is(old[key], unit[key])) continue;
      if (
        typeof unit[key] === 'object' &&
        JSON.stringify(old[key]) === JSON.stringify(unit[key])
      )
        continue;
      if (unit[key] === undefined) unset.push(key as CombatV6OptionalUnitField);
      else Object.assign(set, { [key]: unit[key] });
    }
    if (Object.keys(set).length || unset.length)
      frame.updates.push({
        id: unit.id,
        set,
        ...(unset.length ? { unset } : {}),
      });
  }
  if (previous.size) frame.removed = [...previous.keys()];
  const afterIds = new Set(after.map((u) => u.id));
  const defaultOrder = [
    ...before.filter((u) => afterIds.has(u.id)),
    ...(frame.added ?? []),
  ];
  if (defaultOrder.some((u, i) => u.id !== after[i]?.id))
    frame.order = after.map((u) => u.id);
  return frame;
}

/** Preserve references for untouched units; fail closed when the baseline is missing. */
export function applyUnitDelta(
  units: Unit[],
  frame: CombatV6DeltaFrameV1,
): Unit[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const touched = new Set<string>();
  for (const id of frame.removed ?? []) {
    if (!byId.delete(id) || touched.has(id))
      throw new Error('Invalid removed unit');
    touched.add(id);
  }
  for (const update of frame.updates) {
    const old = byId.get(update.id);
    if (!old || touched.has(update.id))
      throw new Error('Missing delta baseline');
    touched.add(update.id);
    const next = { ...old, ...update.set, id: old.id };
    for (const key of update.unset ?? []) delete next[key];
    byId.set(old.id, next);
  }
  for (const unit of frame.added ?? []) {
    if (byId.has(unit.id) || touched.has(unit.id))
      throw new Error('Duplicate added unit');
    touched.add(unit.id);
    byId.set(unit.id, unit);
  }
  if (frame.order) {
    if (
      frame.order.length !== byId.size ||
      new Set(frame.order).size !== byId.size ||
      frame.order.some((id) => !byId.has(id))
    )
      throw new Error('Invalid unit order');
    return frame.order.map((id) => byId.get(id)!);
  }
  return touched.size ? [...byId.values()] : units;
}

export function contiguousEvents(
  events: readonly { seq: number }[],
  from: number,
  through: number,
): boolean {
  let expected = from + 1;
  for (const { seq } of events) {
    if (seq <= from) continue;
    if (seq > through) break;
    if (seq !== expected++) return false;
  }
  return expected === through + 1;
}
