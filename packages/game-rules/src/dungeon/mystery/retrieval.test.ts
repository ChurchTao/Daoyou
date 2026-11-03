import { getMysteryTemplate } from '@daoyou/game-content/dungeon/scenarios';
import type {
  MysteryCaseFile,
  MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';
import { describe, expect, it } from 'vitest';
import {
  applyMysteryAction,
  applyMysteryGuardBattle,
  createMysteryRun,
  mysteryGuardChallenge,
} from './engine.js';
import { projectMysteryView } from './projection.js';
import { mysteryConfrontationTarget, scoreMysteryRun } from './scoring.js';
import { buildMysterySkeleton } from './skeleton.js';
import {
  computeMysteryReachability,
  estimateMysteryMinimumActions,
  validateMysteryCase,
} from './validate.js';

const template = getMysteryTemplate('lost_relic')!;

/** 每道题选一条真正支撑它的关键线索作为证据。 */
const aptEvidence = (caseFile: MysteryCaseFile) =>
  Object.fromEntries(
    caseFile.questions.map((q) => [
      q.id,
      caseFile.clues
        .filter((c) => c.key && c.supports.includes(q.id))
        .slice(0, 1)
        .map((c) => c.id),
    ]),
  );
const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);
const SOLVED = { where: 'place_true', how: 'method_true', owner: 'npc_owner' };

function caseWithGuards(count: number): MysteryCaseFile {
  for (const seed of seeds) {
    const { caseFile } = buildMysterySkeleton(template, seed);
    if ((caseFile.guards?.length ?? 0) === count) return caseFile;
  }
  throw new Error(`没有 ${count} 个守卫的种子`);
}

/** 拿到全部可达线索与标记、停在守卫房间隔壁的运行态。 */
function readyRun(caseFile: MysteryCaseFile, guardIndex = 0): MysteryRunState {
  const reach = computeMysteryReachability(caseFile);
  const guard = caseFile.guards![guardIndex]!;
  const parent = caseFile.rooms.find((r) => r.exits.includes(guard.roomId))!;
  return {
    ...createMysteryRun(caseFile, template.scale.action_budget),
    location: parent.id,
    visited: [...reach.rooms].filter((r) => r !== guard.roomId),
    clues: [...reach.clues],
    items: [...reach.items],
    flags: [...reach.flags],
  };
}

describe('retrieval skeleton', () => {
  it('produces valid, solvable cases for every seed', () => {
    for (const seed of seeds) {
      const { caseFile } = buildMysterySkeleton(template, seed);
      expect(validateMysteryCase(caseFile, template), `seed ${seed}`).toEqual(
        [],
      );
      expect(estimateMysteryMinimumActions(caseFile)).toBeLessThanOrEqual(
        template.scale.action_budget * 0.75,
      );
    }
  });

  it('varies guards, keeper, sealed room and answer positions across seeds', () => {
    const seen = {
      guards: new Set<number>(),
      keeper: new Set<boolean>(),
      sealed: new Set<boolean>(),
      tool: new Set<boolean>(),
      answerAt: new Set<number>(),
    };
    for (const seed of seeds) {
      const { caseFile } = buildMysterySkeleton(template, seed);
      seen.guards.add(caseFile.guards?.length ?? 0);
      seen.keeper.add(caseFile.npcs.some((n) => n.role === 'keeper'));
      seen.sealed.add(caseFile.rooms.some((r) => r.requires));
      seen.tool.add(caseFile.interactions.length > 0);
      const where = caseFile.questions.find((q) => q.id === 'where')!;
      seen.answerAt.add(where.options!.findIndex((o) => o.id === 'place_true'));
    }
    expect([...seen.guards].sort()).toEqual([0, 1, 2]);
    expect(seen.keeper.size).toBe(2);
    expect(seen.sealed.size).toBe(2);
    expect(seen.tool.size).toBe(2);
    expect(seen.answerAt.size).toBe(4);
  });

  it('turns the decoy when shown the forged lead', () => {
    const { caseFile } = buildMysterySkeleton(template, 42);
    const decoy = caseFile.npcs.find((n) => n.role === 'decoy')!;
    expect(decoy.reactions[0]).toMatchObject({
      evidenceId: 'clue_forged',
      effects: [
        { kind: 'reveal_clue', clueId: 'clue_debunk' },
        { kind: 'set_flag', flag: 'decoy_turned' },
      ],
    });
  });
});

describe('guards', () => {
  it('blocks the room until bypassed with the right item', () => {
    const caseFile = caseWithGuards(1);
    const guard = caseFile.guards![0]!;
    const run = readyRun(caseFile);
    expect(
      applyMysteryAction(caseFile, run, { type: 'move', roomId: guard.roomId }),
    ).toMatchObject({ ok: false });
    const exit = projectMysteryView(
      { templateId: template.id, caseSource: 'fallback', caseFile, run },
      template,
    ).exits.find((e) => e.id === guard.roomId);
    expect(exit?.guard).toMatchObject({ id: guard.id, canBypass: true });

    const without = {
      ...run,
      items: run.items.filter((i) => i !== 'item_pass'),
    };
    expect(
      applyMysteryAction(caseFile, without, {
        type: 'bypass_guard',
        guardId: guard.id,
      }),
    ).toEqual({ ok: false, error: '你还没有化解它的办法' });

    const passed = applyMysteryAction(caseFile, run, {
      type: 'bypass_guard',
      guardId: guard.id,
    });
    expect(passed.ok && passed.run).toMatchObject({
      location: guard.roomId,
      passedGuards: [guard.id],
      actionsLeft: run.actionsLeft - 1,
    });
  });

  it('enters on a won battle and stays put on a lost one', () => {
    const caseFile = caseWithGuards(2);
    const run = readyRun(caseFile, 1);
    const guard = caseFile.guards![1]!;
    expect(mysteryGuardChallenge(caseFile, run, guard.id)).toMatchObject({
      ok: true,
    });
    const lost = applyMysteryGuardBattle(caseFile, run, guard.id, false);
    expect(lost.ok && lost.run).toMatchObject({
      location: run.location,
      actionsLeft: run.actionsLeft - 1,
    });
    expect(lost.ok && lost.run.passedGuards).toBeUndefined();
    const won = applyMysteryGuardBattle(caseFile, run, guard.id, true);
    expect(won.ok && won.run).toMatchObject({
      location: guard.roomId,
      passedGuards: [guard.id],
    });
    expect(
      mysteryGuardChallenge(caseFile, won.ok ? won.run : run, guard.id),
    ).toMatchObject({ ok: false });
  });
  it('notes that a beaten guard no longer blocks the room it guarded', () => {
    const caseFile = caseWithGuards(2);
    const run = readyRun(caseFile, 1);
    const guard = caseFile.guards![1]!;
    const won = applyMysteryGuardBattle(caseFile, run, guard.id, true);
    if (!won.ok) throw new Error(won.error);
    const lines = won.run.log
      .filter((e) => e.turn === won.run.turn)
      .map((e) => e.kind);
    expect(lines).toEqual(['system', 'scene', 'system']);
    expect(won.run.log.at(-1)?.text).toBe(`${guard.name}已不再拦路。`);
  });
});

describe('repeated hints', () => {
  it('does not charge for asking again when nothing has changed', () => {
    const caseFile = caseWithGuards(1);
    const run = createMysteryRun(caseFile, template.scale.action_budget);
    const first = applyMysteryAction(caseFile, run, { type: 'reflect' });
    if (!first.ok) throw new Error(first.error);
    expect(first.run.actionsLeft).toBe(run.actionsLeft - 1);
    const again = applyMysteryAction(caseFile, first.run, { type: 'reflect' });
    if (!again.ok) throw new Error(again.error);
    expect(again.run).toMatchObject({
      actionsLeft: first.run.actionsLeft,
      turn: first.run.turn,
    });
    expect(again.run.log.at(-1)?.text).toBe(
      `还是那个念头：${first.run.log.at(-1)!.text}`,
    );
    const third = applyMysteryAction(caseFile, again.run, { type: 'reflect' });
    expect(third.ok && third.run.actionsLeft).toBe(first.run.actionsLeft);
  });
});

describe('retrieval scoring', () => {
  it('scores a full solve with every guard passed and the rival beaten as 100', () => {
    const caseFile = caseWithGuards(2);
    const reach = computeMysteryReachability(caseFile);
    const run: MysteryRunState = {
      ...createMysteryRun(caseFile, template.scale.action_budget),
      clues: [...reach.clues],
      flags: [...reach.flags],
      firedReactions: caseFile.npcs.flatMap((n) =>
        n.reactions.map((r) => r.id),
      ),
      passedGuards: caseFile.guards!.map((g) => g.id),
    };
    const result = scoreMysteryRun(
      caseFile,
      template,
      run,
      SOLVED,
      'won',
      aptEvidence(caseFile),
    );
    expect(result.total).toBe(100);
    expect(result.branches).toEqual(['lies_exposed', 'decoy_turned']);
    expect(result.guards).toEqual({ passed: 2, total: 2 });

    const half = scoreMysteryRun(
      caseFile,
      template,
      { ...run, passedGuards: [caseFile.guards![0]!.id] },
      SOLVED,
      'spared',
    );
    expect(half.breakdown.combat).toBe(5);
  });

  it('gives the guard share in full when the case has no guards', () => {
    const caseFile = caseWithGuards(0);
    const run = createMysteryRun(caseFile, template.scale.action_budget);
    const result = scoreMysteryRun(caseFile, template, run, SOLVED, 'lost');
    expect(result.breakdown.combat).toBe(10);
    expect(result.guards).toBeUndefined();
  });

  it('brings out the rival only when both the place and the method are right', () => {
    const { caseFile } = buildMysterySkeleton(template, 7);
    expect(mysteryConfrontationTarget(caseFile, template, SOLVED)?.role).toBe(
      'rival',
    );
    expect(
      mysteryConfrontationTarget(caseFile, template, {
        ...SOLVED,
        how: 'method_force',
      }),
    ).toBeNull();
  });
});

describe('timed events', () => {
  const look = (caseFile: MysteryCaseFile, run: MysteryRunState) => {
    const result = applyMysteryAction(caseFile, run, {
      type: 'search',
      objectId: 'obj_entrance',
    });
    if (!result.ok) throw new Error(result.error);
    return result.run;
  };

  it('warns first, then erases the true-place traces and sends the decoy away', () => {
    const { caseFile } = buildMysterySkeleton(template, 11);
    const erase = caseFile.events!.find((e) => e.id === 'evt_erase')!;
    const leave = caseFile.events!.find((e) => e.id === 'evt_leave')!;
    let run = createMysteryRun(caseFile, template.scale.action_budget);
    run = look(caseFile, { ...run, turn: erase.warnAt - 1 });
    expect(run.events).toEqual(['warn:evt_erase']);
    expect(run.log.at(-1)).toMatchObject({ kind: 'omen' });
    run = look(caseFile, { ...run, turn: leave.at - 1 });
    expect(run.events).toEqual(
      expect.arrayContaining(['evt_erase', 'evt_leave']),
    );
    expect(run.destroyed).toEqual(['obj_place']);
    expect(run.departed).toEqual(['npc_decoy']);

    const decoy = caseFile.npcs.find((n) => n.id === 'npc_decoy')!;
    const there = { ...run, location: decoy.roomId };
    expect(
      applyMysteryAction(caseFile, there, { type: 'talk', npcId: decoy.id }),
    ).toEqual({ ok: false, error: '此人不在这里' });
    const view = projectMysteryView(
      { templateId: template.id, caseSource: 'fallback', caseFile, run: there },
      template,
    );
    expect(view.npcsHere.some((n) => n.id === decoy.id)).toBe(false);
  });

  it('does not happen once the player got there first', () => {
    const { caseFile } = buildMysterySkeleton(template, 11);
    const erase = caseFile.events!.find((e) => e.id === 'evt_erase')!;
    const run = look(caseFile, {
      ...createMysteryRun(caseFile, template.scale.action_budget),
      turn: erase.at - 1,
      clues: ['clue_place'],
      flags: ['decoy_turned'],
    });
    expect(run.events ?? []).toEqual([]);
    expect(run.destroyed).toBeUndefined();
  });
});
