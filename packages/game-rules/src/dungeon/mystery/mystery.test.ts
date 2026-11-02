import { describe, expect, it } from 'vitest';
import {
  getMysteryFallbackCase,
  getMysteryTemplate,
  listMysteryTemplates,
} from '@daoyou/game-content/dungeon/scenarios';
import type {
  MysteryAction,
  MysteryCaseFile,
  MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';
import { applyMysteryAction, createMysteryRun } from './engine.js';
import { projectMysteryView } from './projection.js';
import { checkMysteryAnswers, scoreMysteryRun } from './scoring.js';
import { computeMysteryReachability, validateMysteryCase } from './validate.js';

const template = getMysteryTemplate('inheritance_murder')!;

function fallback(): MysteryCaseFile {
  return getMysteryFallbackCase('inheritance_murder')!;
}

function play(caseFile: MysteryCaseFile, actions: MysteryAction[]) {
  let run = createMysteryRun(caseFile, template.scale.action_budget);
  for (const action of actions) {
    const result = applyMysteryAction(caseFile, run, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
    run = result.run;
  }
  return run;
}

const SOLVE: MysteryAction[] = [
  { type: 'move', roomId: 'stone_hall' },
  { type: 'search', objectId: 'remains' },
  { type: 'move', roomId: 'alchemy' },
  { type: 'search', objectId: 'shelf' },
  { type: 'use', itemId: 'fire_tongs', targetId: 'furnace' },
  { type: 'move', roomId: 'stone_hall' },
  { type: 'move', roomId: 'quiet_room' },
  { type: 'search', objectId: 'bookcase' },
  { type: 'search', objectId: 'stone_door' },
  { type: 'present', npcId: 'su', evidenceId: 'seal_pattern' },
  { type: 'move', roomId: 'tunnel' },
  { type: 'search', objectId: 'escape_pack' },
  { type: 'move', roomId: 'quiet_room' },
  { type: 'move', roomId: 'stone_hall' },
  { type: 'present', npcId: 'han', evidenceId: 'roster_page' },
];

const CORRECT = { who: 'han', how: 'poison_ash', heir: 'su' };

describe('mystery scenario content', () => {
  it('ships a fallback case for every template that passes validation', () => {
    for (const t of listMysteryTemplates()) {
      const caseFile = getMysteryFallbackCase(t.id);
      expect(caseFile, t.id).toBeDefined();
      expect(validateMysteryCase(caseFile!, t)).toEqual([]);
    }
  });
});

describe('mystery case validation', () => {
  it('reports a key clue that can never be obtained', () => {
    const caseFile = fallback();
    caseFile.interactions = [];
    expect(validateMysteryCase(caseFile, template)).toContain(
      '关键线索 poison_ash 无法获得',
    );
  });

  it('treats rooms behind an unobtainable key as unreachable', () => {
    const caseFile = fallback();
    caseFile.items = caseFile.items.filter((i) => i.id !== 'bronze_key');
    const reach = computeMysteryReachability(caseFile);
    expect(reach.rooms.has('tunnel')).toBe(false);
    expect(validateMysteryCase(caseFile, template)).toContain(
      '房间 tunnel 无法到达',
    );
  });

  it('rejects dangling references and wrong answer kinds', () => {
    const caseFile = fallback();
    caseFile.rooms[0]!.exits.push('nowhere');
    caseFile.questions[1]!.answer = 'claw_marks';
    const issues = validateMysteryCase(caseFile, template);
    expect(issues).toContain('房间 waterfall 的出口 nowhere 不存在');
    expect(issues).toContain('结案问题 how 的答案应为关键线索 id');
  });
});

describe('mystery engine', () => {
  it('blocks locked rooms until the condition is met', () => {
    const caseFile = fallback();
    const run = play(caseFile, [
      { type: 'move', roomId: 'stone_hall' },
      { type: 'move', roomId: 'quiet_room' },
    ]);
    const result = applyMysteryAction(caseFile, run, {
      type: 'move',
      roomId: 'tunnel',
    });
    expect(result).toEqual({
      ok: false,
      error: '石门紧闭，下方的凹槽像在等一枚铜钥。',
    });
  });

  it('only allows interacting with things in the current room', () => {
    const caseFile = fallback();
    const run = createMysteryRun(caseFile, 24);
    expect(
      applyMysteryAction(caseFile, run, { type: 'search', objectId: 'remains' }),
    ).toMatchObject({ ok: false });
    expect(
      applyMysteryAction(caseFile, run, { type: 'talk', npcId: 'han' }),
    ).toMatchObject({ ok: false });
  });

  it('charges a first search but not a repeat look', () => {
    const caseFile = fallback();
    const run = play(caseFile, [
      { type: 'search', objectId: 'moss_wall' },
      { type: 'search', objectId: 'moss_wall' },
    ]);
    expect(run.actionsLeft).toBe(23);
    expect(run.clues).toEqual(['claw_marks']);
  });

  it('unlocks secrets and reactions through conditions and evidence', () => {
    const caseFile = fallback();
    const run = play(caseFile, SOLVE);
    expect(new Set(run.clues)).toEqual(
      new Set([
        'finger_mark',
        'spilled_pills',
        'poison_ash',
        'roster_page',
        'seal_pattern',
        'pendant_match',
        'han_pack',
      ]),
    );
    expect(run.flags).toEqual(['heir_trusted', 'han_exposed']);
    expect(run.items).toEqual(['bronze_key', 'fire_tongs']);

    const talked = applyMysteryAction(caseFile, run, {
      type: 'talk',
      npcId: 'han',
    });
    expect(talked.ok && talked.newClues).toEqual(['han_claim']);
  });

  it('refuses further actions once the budget is spent', () => {
    const caseFile = fallback();
    const run: MysteryRunState = { ...createMysteryRun(caseFile, 24), actionsLeft: 0 };
    expect(
      applyMysteryAction(caseFile, run, { type: 'move', roomId: 'stone_hall' }),
    ).toEqual({ ok: false, error: '行动力已耗尽，只能结案推理' });
  });
});

describe('mystery scoring', () => {
  it('awards S for a thorough correct deduction', () => {
    const caseFile = fallback();
    const run = play(caseFile, SOLVE);
    const result = scoreMysteryRun(caseFile, template, run, CORRECT);
    expect(result.correct).toEqual({ who: true, how: true, heir: true });
    expect(result.branches).toEqual(['lies_exposed', 'heir_trusted']);
    expect(result.keyCluesFound).toBe(result.keyCluesTotal);
    expect(result.breakdown).toEqual({
      truth: 55,
      coverage: 20,
      efficiency: 11,
      branch: 10,
      combat: 0,
    });
    expect(result.tier).toBe('S');
  });

  it('withholds efficiency from blind guessing', () => {
    const caseFile = fallback();
    const run = createMysteryRun(caseFile, 24);
    const result = scoreMysteryRun(caseFile, template, run, {
      who: 'su',
      how: 'poison_ash',
      heir: 'han',
    });
    expect(result.breakdown.truth).toBe(18);
    expect(result.breakdown.efficiency).toBe(5);
    expect(result.tier).toBe('D');
    expect(scoreMysteryRun(caseFile, template, run, {}).total).toBe(0);
  });

  it('only accepts clue answers the player actually holds', () => {
    const caseFile = fallback();
    const run = play(caseFile, [{ type: 'move', roomId: 'stone_hall' }]);
    expect(checkMysteryAnswers(caseFile, template, run, CORRECT)).toBe(
      '凶手用了什么手段：只能以已掌握的线索作答',
    );
    const solved = play(caseFile, SOLVE);
    expect(checkMysteryAnswers(caseFile, template, solved, CORRECT)).toBeNull();
    expect(
      checkMysteryAnswers(caseFile, template, solved, { ...CORRECT, x: 'y' }),
    ).toBe('未知的问题：x');
  });
});

describe('mystery projection', () => {
  it('hides truth and unrevealed clues until the case is closed', () => {
    const caseFile = fallback();
    const run = play(caseFile, [{ type: 'move', roomId: 'stone_hall' }]);
    const view = projectMysteryView(
      { templateId: template.id, caseSource: 'fallback', caseFile, run },
      template,
    );
    const json = JSON.stringify(view);
    expect(json).not.toContain(caseFile.truth);
    expect(json).not.toContain('断魂香');
    expect(view.result).toBeUndefined();
    expect(view.npcsHere.map((n) => n.id)).toEqual(['han']);
    expect(view.exits.map((e) => e.id).sort()).toEqual(
      ['alchemy', 'quiet_room', 'waterfall'].sort(),
    );

    const solved = play(caseFile, SOLVE);
    const closed = projectMysteryView(
      {
        templateId: template.id,
        caseSource: 'fallback',
        caseFile,
        run: solved,
        result: scoreMysteryRun(caseFile, template, solved, CORRECT),
      },
      template,
    );
    expect(closed.result?.truth).toBe(caseFile.truth);
    expect(closed.result?.explanations[0]).toMatchObject({
      prompt: '谁害死了洞府主人',
      answerLabel: '韩老三',
    });
  });
});
