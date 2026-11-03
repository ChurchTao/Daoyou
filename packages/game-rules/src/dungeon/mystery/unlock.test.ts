import { getMysteryTemplate } from '@daoyou/game-content/dungeon/scenarios';
import type {
  MysteryCaseFile,
  MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';
import { describe, expect, it } from 'vitest';
import { applyMysteryAction, createMysteryRun } from './engine.js';
import {
  mechanismCandidates,
  mechanismSequences,
  pickHintRules,
  renderHintRule,
} from './mechanism.js';
import { projectMysteryView } from './projection.js';
import { mysteryConfrontationTarget, scoreMysteryRun } from './scoring.js';
import { buildMysterySkeleton } from './skeleton.js';
import {
  estimateMysteryMinimumActions,
  validateMysteryCase,
} from './validate.js';

const template = getMysteryTemplate('trial_seal')!;
const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 3);

/** 站在机关所在房间的运行态。 */
function atMechanism(caseFile: MysteryCaseFile, n: 1 | 2): MysteryRunState {
  const room = caseFile.objects.find((o) => o.id === `obj_mech_${n}`)!.roomId;
  return {
    ...createMysteryRun(caseFile, template.scale.action_budget),
    location: room,
    visited: [caseFile.startRoomId, room],
  };
}

describe('mechanism rules', () => {
  it('always finds hint rules that pin down exactly one sequence', () => {
    const parts = ['a', 'b', 'c', 'd'];
    let x = 1;
    const random = () => (x = (x * 48271) % 2147483647) / 2147483647;
    for (const solution of mechanismSequences(parts)) {
      const rules = pickHintRules(parts, solution, random);
      expect(rules.length).toBeLessThanOrEqual(3);
      expect(mechanismCandidates(parts, rules)).toEqual([solution]);
    }
  });

  it('renders hints in plain words', () => {
    const label = (id: string) => ({ a: '坎', b: '离' })[id] ?? id;
    expect(
      renderHintRule({ kind: 'position', part: 'a', index: 0 }, label),
    ).toBe('坎居第一');
    expect(
      renderHintRule({ kind: 'before', first: 'a', then: 'b' }, label),
    ).toBe('坎在离之前');
    expect(renderHintRule({ kind: 'absent', part: 'b' }, label)).toBe(
      '离不在其中',
    );
  });
});

describe('unlock skeleton', () => {
  it('produces valid, solvable cases for every seed', () => {
    for (const seed of seeds) {
      const { caseFile, sequences } = buildMysterySkeleton(template, seed);
      expect(validateMysteryCase(caseFile, template), `seed ${seed}`).toEqual(
        [],
      );
      expect(estimateMysteryMinimumActions(caseFile)).toBeLessThanOrEqual(
        template.scale.action_budget * 0.75,
      );
      const order = caseFile.questions.find((q) => q.id === 'order')!;
      expect(
        order.options!.map((o) => sequences![o.id]!.join()).sort(),
      ).toEqual(
        [
          ...new Set(order.options!.map((o) => sequences![o.id]!.join())),
        ].sort(),
      );
    }
  });
});

describe('operating a mechanism', () => {
  it('opens on the right sequence and reveals the seal fragment', () => {
    const { caseFile } = buildMysterySkeleton(template, 17);
    const mech = caseFile.mechanisms!.find((m) => m.id === 'mech_1')!;
    const run = atMechanism(caseFile, 1);
    const result = applyMysteryAction(caseFile, run, {
      type: 'operate',
      mechanismId: 'mech_1',
      sequence: mech.solution,
    });
    expect(result.ok && result.run).toMatchObject({
      actionsLeft: run.actionsLeft - 1,
      mechanisms: { mech_1: { solved: true, failures: 0 } },
    });
    expect(result.ok && result.run.clues).toContain('clue_frag_1');
    expect(result.ok && result.run.flags).toContain('mech_1_solved');
  });

  it('shows only the hints the player has found, in plain words', () => {
    const { caseFile } = buildMysterySkeleton(template, 17);
    const mech = caseFile.mechanisms!.find((m) => m.id === 'mech_1')!;
    const run = atMechanism(caseFile, 1);
    const project = (clues: string[]) =>
      projectMysteryView(
        {
          templateId: template.id,
          caseSource: 'fallback',
          caseFile,
          run: { ...run, clues },
        },
        template,
      ).objects.find((o) => o.id === 'obj_mech_1')!.mechanism!.hints;
    expect(project([]).every((h) => h === null)).toBe(true);
    const found = project([mech.hints[0]!.clueId]);
    expect(found[0]).toBe(
      renderHintRule(
        mech.hints[0]!.rule,
        (id) => mech.parts.find((p) => p.id === id)!.label,
      ),
    );
    expect(found.slice(1).every((h) => h === null)).toBe(true);
  });

  it('backlashes on a wrong sequence and locks after three failures', () => {
    const { caseFile } = buildMysterySkeleton(template, 17);
    const mech = caseFile.mechanisms!.find((m) => m.id === 'mech_1')!;
    const wrong = mechanismSequences(mech.parts.map((p) => p.id)).find(
      (s) => s.join() !== mech.solution.join(),
    )!;
    let run = atMechanism(caseFile, 1);
    for (let i = 0; i < 3; i++) {
      const result = applyMysteryAction(caseFile, run, {
        type: 'operate',
        mechanismId: 'mech_1',
        sequence: wrong,
      });
      if (!result.ok) throw new Error(result.error);
      run = result.run;
    }
    expect(run.actionsLeft).toBe(template.scale.action_budget - 6);
    expect(run.mechanisms!.mech_1).toEqual({
      failures: 3,
      solved: false,
      locked: true,
    });
    expect(
      applyMysteryAction(caseFile, run, {
        type: 'operate',
        mechanismId: 'mech_1',
        sequence: mech.solution,
      }),
    ).toEqual({ ok: false, error: '这处机关已经锁死' });
    const view = projectMysteryView(
      { templateId: template.id, caseSource: 'fallback', caseFile, run },
      template,
    );
    expect(
      view.objects.find((o) => o.id === 'obj_mech_1')?.mechanism,
    ).toMatchObject({
      locked: true,
      failures: 3,
      maxFailures: 3,
    });
  });

  it('refuses to operate the final seal during the investigation', () => {
    const { caseFile } = buildMysterySkeleton(template, 17);
    const seal = caseFile.mechanisms!.find((m) => m.final)!;
    const run = {
      ...createMysteryRun(caseFile, template.scale.action_budget),
      location: 'room_hub',
    };
    expect(
      applyMysteryAction(caseFile, run, {
        type: 'operate',
        mechanismId: seal.id,
        sequence: seal.solution,
      }),
    ).toEqual({ ok: false, error: '此处没有这处机关' });
  });

  it('marks a clean trial when both mechanisms open without backlash', () => {
    const { caseFile } = buildMysterySkeleton(template, 23);
    let run = atMechanism(caseFile, 1);
    for (const n of [1, 2] as const) {
      const mech = caseFile.mechanisms!.find((m) => m.id === `mech_${n}`)!;
      const room = caseFile.objects.find((o) => o.id === mech.objectId)!.roomId;
      const result = applyMysteryAction(
        caseFile,
        { ...run, location: room },
        { type: 'operate', mechanismId: mech.id, sequence: mech.solution },
      );
      if (!result.ok) throw new Error(result.error);
      run = result.run;
    }
    expect(run.flags).toContain('trial_clean');
  });
});

describe('unlock finale', () => {
  it('brings out the warden when order and catalyst are right', () => {
    const { caseFile } = buildMysterySkeleton(template, 5);
    const solved = {
      order: 'order_true',
      catalyst: 'catalyst_true',
      cause: 'cause_true',
    };
    expect(mysteryConfrontationTarget(caseFile, template, solved)?.role).toBe(
      'warden',
    );
    expect(
      mysteryConfrontationTarget(caseFile, template, {
        ...solved,
        order: 'order_rival',
      }),
    ).toBeNull();
    const run = createMysteryRun(caseFile, template.scale.action_budget);
    expect(
      scoreMysteryRun(caseFile, template, run, solved, 'won').breakdown.combat,
    ).toBe(caseFile.guards?.length ? 10 : 15);
  });
});
