import type { BattleEvent } from '@shared/engine/combat-v6/core';
import type { CombatV6Session, CombatV6Unit, SequencedEvent } from './session';

export function unitLabels(units: CombatV6Unit[]) {
  const byId = new Map(units.map((u) => [u.id, u]));
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.name, (counts.get(u.name) ?? 0) + 1);
  return new Map(
    units.map((u) => {
      const slot =
        (u.ownerId ? byId.get(u.ownerId)?.slot : undefined) ?? u.slot;
      return [
        u.id,
        (counts.get(u.name) ?? 0) > 1
          ? `${u.name}〔${u.side === 0 ? '我' : '敌'}${slot + 1}${u.ownerId ? '·召' : ''}〕`
          : u.name,
      ];
    }),
  );
}
export function reasonText(reason: string) {
  const labels: Record<string, string> = {
    'not-command-phase': '当前不能下令',
    'unit-cannot-act': '当前无法行动',
    'blocks-action': '受控制，无法行动',
    sealed: '受封术影响',
    rooted: '物理行动受限',
    'no-target': '没有合法目标',
    'hp-requirement': '气血未达到施展要求',
    'insufficient-mp': '法力不足',
    'resource-requirement': '战斗资源不足',
    'skip-next-action': '本次行动休息',
    'not-standing': '当前无法行动',
    'flee-failed': '逃离失败',
    'revive-blocked': '当前无法复起',
    'skill-not-known': '尚未掌握此技能',
    'passive-not-castable': '被动技能无法主动施展',
    'summon-invalid': '无法召出该灵兽',
    'summon-dead': '灵兽已死亡',
    'summon-already-out': '灵兽已在场',
  };
  return labels[reason] ?? labels[reason.split(':')[0]] ?? '当前条件不满足';
}
export type LogLine = {
  seq: number;
  text: string;
  tone?: 'damage' | 'heal';
  detail?: boolean;
};
export type ActionEntry = {
  seq: number;
  round: number;
  endSeq: number;
  title: string;
  lines: LogLine[];
};
export type BattleLog = {
  entries: ActionEntry[];
  round: number;
  open: boolean;
  seq: number;
};
export function appendBattleEntries(
  previous: BattleLog,
  events: SequencedEvent[],
  session: CombatV6Session,
): BattleLog {
  if (!events.length) return previous;
  const result = [...previous.entries];
  let round = previous.round;
  let entry =
    previous.open && result.length
      ? {
          ...result[result.length - 1],
          lines: [...result[result.length - 1].lines],
        }
      : undefined;
  if (entry) result[result.length - 1] = entry;
  const names = unitLabels(session.units);
  const name = (id?: string) => names.get(id ?? '') ?? '未知单位';
  const resources = new Map(
    session.units.flatMap((u) =>
      u.resources.map((r) => [r.id, r.name] as const),
    ),
  );
  const status = (id: string) => session.display?.statuses[id] ?? '未知状态';
  const resource = (id: string) => resources.get(id) ?? '战斗资源';
  const add = (seq: number, line: Omit<LogLine, 'seq'>) => {
    if (!entry) {
      entry = {
        seq,
        endSeq: seq,
        round,
        title: round ? '回合变化' : '战斗开始',
        lines: [],
      };
      result.push(entry);
    }
    entry.endSeq = seq;
    entry.lines.push({ ...line, seq });
  };
  for (const { seq, event: e } of events) {
    if (e.type === 'roundStart') {
      round = e.round;
      entry = undefined;
      continue;
    }
    if (e.type === 'roundEnd') {
      entry = undefined;
      continue;
    }
    if (e.type === 'actionStart') {
      const c = e.command;
      const verb =
        c.type === 'skill'
          ? `施展「${session.display?.skills[c.skillId] ?? '技能'}」`
          : c.type === 'attack'
            ? `攻击${name(c.target)}`
            : c.type === 'protect'
              ? `保护${name(c.target)}`
              : c.type === 'defend'
                ? '凝神防御'
                : c.type === 'flee'
                  ? '尝试逃离'
                  : '开始行动';
      entry = {
        seq,
        endSeq: seq,
        round,
        title: `${name(e.unitId)}${verb}`,
        lines: [],
      };
      result.push(entry);
      continue;
    }
    if (e.type === 'actionSkip') {
      entry = {
        seq,
        endSeq: seq,
        round,
        title: `${name(e.unitId)}无法行动`,
        lines: [{ seq, text: reasonText(e.reason) }],
      };
      result.push(entry);
      continue;
    }
    const line = eventLine(e);
    if (line) add(seq, line);
  }
  return {
    entries: result,
    round,
    open: !!entry,
    seq: events[events.length - 1].seq,
  };

  function eventLine(e: BattleEvent): Omit<LogLine, 'seq'> | undefined {
    switch (e.type) {
      case 'damage':
        return {
          text: `${name(e.targetId)}受到 ${e.amount} 点伤害`,
          tone: 'damage',
        };
      case 'heal':
        return {
          text: `${name(e.targetId)}恢复 ${e.amount} 气血`,
          tone: 'heal',
        };
      case 'miss':
        return { text: `${name(e.targetId)}未被命中` };
      case 'protectTrigger':
        return {
          text: `${name(e.protectorId)}挺身保护${name(e.originalTargetId)}`,
        };
      case 'actionFailed':
        return { text: `${name(e.unitId)}行动失败：${reasonText(e.reason)}` };
      case 'retarget':
        return { text: `目标转向${name(e.to)}` };
      case 'statusApplied':
        return {
          text: `${name(e.unitId)}获得「${status(e.statusId)}」· ${e.duration}回合`,
        };
      case 'statusRemoved':
        return { text: `${name(e.unitId)}的「${status(e.statusId)}」解除` };
      case 'unitDowned':
        return { text: `${name(e.unitId)}倒地` };
      case 'unitDead':
        return { text: `${name(e.unitId)}战死` };
      case 'unitEscaped':
        return { text: `${name(e.unitId)}离场` };
      case 'unitRevived':
        return {
          text: `${name(e.unitId)}复起，恢复 ${e.hp} 气血`,
          tone: 'heal',
        };
      case 'barrierChanged':
        return { text: `${name(e.unitId)}护盾 ${e.before} → ${e.after}` };
      case 'woundChanged':
        return { text: `${name(e.targetId)}伤势 ${e.before} → ${e.after}` };
      case 'mechanicTriggered':
        return { text: `${name(e.sourceId)}触发「${e.name}」` };
      case 'mpCost':
        return { text: `${name(e.unitId)}法力 −${e.amount}`, detail: true };
      case 'hpCost':
        return { text: `${name(e.unitId)}气血 −${e.amount}`, detail: true };
      case 'mpDamage':
        return { text: `${name(e.targetId)}法力 −${e.amount}` };
      case 'mpRestore':
        return { text: `${name(e.unitId)}法力 +${e.amount}`, detail: true };
      case 'resourceChanged':
        return {
          text: `${name(e.unitId)}${resource(e.resourceId)} ${e.before} → ${e.after}`,
          detail: true,
        };
      case 'chanceResolved':
        return { text: `机缘判定${e.success ? '成功' : '失败'}`, detail: true };
      case 'petSummoned':
        return { text: `${name(e.unitId)}召出${name(e.petId)}` };
      case 'petRecalled':
        return { text: `${name(e.unitId)}收回${name(e.petId)}` };
      default:
        return undefined;
    }
  }
}
