import {
  getMysteryFallbackCase,
  getMysteryTemplate,
  listMysteryTemplates,
} from '@daoyou/game-content/dungeon/scenarios';
import { getAllSatelliteNodes } from '@daoyou/game-content/world/map';
import {
  MysteryCaseFileSchema,
  type MysteryAction,
  type MysteryCaseFile,
  type MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';
import { describe, expect, it } from 'vitest';
import {
  applyMysteryAction,
  applyMysteryDialogue,
  createMysteryRun,
  mysteryRevealableSecrets,
} from './engine.js';
import { projectMysteryView } from './projection.js';
import {
  checkMysteryAnswers,
  mysteryConfrontationTarget,
  scoreMysteryRun,
} from './scoring.js';
import { buildMysterySkeleton } from './skeleton.js';
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

const CORRECT = { who: 'han', how: 'poison_incense', heir: 'su' };

describe('mystery scenario content', () => {
  it('ships a fallback case for every template that passes validation', () => {
    for (const t of listMysteryTemplates()) {
      const caseFile = getMysteryFallbackCase(t.id);
      expect(caseFile, t.id).toBeDefined();
      expect(validateMysteryCase(caseFile!, t)).toEqual([]);
    }
  });

  it('gives every dungeon satellite a complete scenario setting', () => {
    const inRange = (list: string[], min: number, max: number) =>
      list.length >= min && list.length <= max;
    const dungeons = getAllSatelliteNodes().filter((n) => n.dungeon_config);
    expect(dungeons.length).toBeGreaterThan(0);
    for (const node of dungeons) {
      const s = node.dungeon_config!.scenario;
      expect(s, node.id).toBeDefined();
      expect(
        s!.templates.every((id) => getMysteryTemplate(id)),
        node.id,
      ).toBe(true);
      expect(s!.setting.length, node.id).toBeLessThanOrEqual(200);
      expect(inRange(s!.places, 6, 10), `${node.id} places`).toBe(true);
      expect(inRange(s!.inhabitants, 4, 8), `${node.id} inhabitants`).toBe(
        true,
      );
      expect(inRange(s!.history, 1, 3), `${node.id} history`).toBe(true);
      expect(inRange(s!.objects, 4, 8), `${node.id} objects`).toBe(true);
      expect(inRange(s!.factions, 0, 4), `${node.id} factions`).toBe(true);
      expect(s!.forbidden.length, `${node.id} forbidden`).toBeGreaterThan(0);
    }
  });

  it('only hands out a fallback case on the node it was written for', () => {
    expect(getMysteryFallbackCase('lost_relic', 'SAT_LX_02')).toBeDefined();
    expect(getMysteryFallbackCase('lost_relic', 'SAT_TN_02')).toBeUndefined();
  });

  it('rejects choice labels that give the answer away', () => {
    const caseFile = fallback();
    caseFile.questions
      .find((q) => q.id === 'how')!
      .options!.find((o) => o.id !== 'poison_incense')!.label = '照伪造的图挖';
    expect(validateMysteryCase(caseFile, template)).toContain(
      '结案问题 how 的选项说法透露了对错',
    );
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
    expect(issues).toContain('结案问题 how 的答案不在选项中');
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
      applyMysteryAction(caseFile, run, {
        type: 'search',
        objectId: 'remains',
      }),
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
    expect(run.actionsLeft).toBe(template.scale.action_budget - 1);
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
    const run: MysteryRunState = {
      ...createMysteryRun(caseFile, 24),
      actionsLeft: 0,
    };
    expect(
      applyMysteryAction(caseFile, run, { type: 'move', roomId: 'stone_hall' }),
    ).toEqual({ ok: false, error: '行动力已耗尽，只能结案推理' });
  });
});

describe('mystery scoring', () => {
  it('awards S for a thorough correct deduction', () => {
    const caseFile = fallback();
    const run = play(caseFile, SOLVE);
    const result = scoreMysteryRun(caseFile, template, run, CORRECT, 'won');
    expect(result.correct).toEqual({ who: true, how: true, heir: true });
    expect(result.branches).toEqual(['lies_exposed', 'heir_trusted']);
    expect(result.keyCluesFound).toBe(result.keyCluesTotal);
    expect(result.breakdown).toEqual({
      truth: 50,
      coverage: 15,
      efficiency: 15,
      branch: 10,
      combat: 10,
    });
    expect(result.confrontation).toBe('won');
    expect(result.tier).toBe('S');
  });

  it('awards combat points only when the exposed culprit is defeated', () => {
    const caseFile = fallback();
    const run = play(caseFile, SOLVE);
    for (const outcome of ['lost', 'spared'] as const) {
      const result = scoreMysteryRun(caseFile, template, run, CORRECT, outcome);
      expect(result.breakdown.combat).toBe(0);
      expect(result.total).toBe(90);
      expect(result.confrontation).toBe(outcome);
    }
  });

  it('confronts the culprit only after a correct accusation', () => {
    const caseFile = fallback();
    expect(mysteryConfrontationTarget(caseFile, template, CORRECT)?.role).toBe(
      'culprit',
    );
    expect(
      mysteryConfrontationTarget(caseFile, template, { ...CORRECT, who: 'su' }),
    ).toBeNull();
    expect(
      mysteryConfrontationTarget(
        caseFile,
        { ...template, finale: undefined },
        CORRECT,
      ),
    ).toBeNull();
  });

  it('withholds efficiency from blind guessing', () => {
    const caseFile = fallback();
    const run = createMysteryRun(caseFile, 24);
    const result = scoreMysteryRun(caseFile, template, run, {
      who: 'su',
      how: 'poison_incense',
      heir: 'han',
    });
    expect(result.breakdown.truth).toBe(17);
    expect(result.breakdown.combat).toBe(0);
    expect(result.breakdown.efficiency).toBe(5);
    expect(result.tier).toBe('D');
    expect(scoreMysteryRun(caseFile, template, run, {}).total).toBe(0);
  });

  it('rejects answers outside the offered choices and unknown questions', () => {
    const caseFile = fallback();
    const solved = play(caseFile, SOLVE);
    expect(checkMysteryAnswers(caseFile, template, solved, CORRECT)).toBeNull();
    expect(
      checkMysteryAnswers(caseFile, template, solved, { ...CORRECT, how: 'x' }),
    ).toBe('凶手用了什么手段：请选择一个选项');
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

describe('mystery skeleton', () => {
  const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);

  it('always produces a schema-valid, solvable case', () => {
    for (const seed of seeds) {
      const { caseFile, purposes } = buildMysterySkeleton(template, seed);
      expect(
        MysteryCaseFileSchema.safeParse(caseFile).success,
        `seed ${seed}`,
      ).toBe(true);
      expect(validateMysteryCase(caseFile, template), `seed ${seed}`).toEqual(
        [],
      );
      for (const id of [
        ...caseFile.rooms.map((r) => r.id),
        ...caseFile.objects.map((o) => o.id),
        ...caseFile.clues.map((c) => c.id),
        ...caseFile.npcs.map((n) => n.id),
      ])
        expect(purposes[id], `${id} purpose`).toBeTruthy();
    }
  });

  it('is deterministic per seed', () => {
    expect(buildMysterySkeleton(template, 42)).toEqual(
      buildMysterySkeleton(template, 42),
    );
  });

  it('varies room count, layout and cast across seeds', () => {
    const shapes = seeds.map((seed) => {
      const { caseFile } = buildMysterySkeleton(template, seed);
      return {
        rooms: caseFile.rooms.length,
        witness: caseFile.npcs.some((n) => n.role === 'witness'),
        layout: JSON.stringify(caseFile.rooms.map((r) => r.exits)),
      };
    });
    expect(new Set(shapes.map((s) => s.rooms))).toEqual(new Set([4, 5, 6]));
    expect(new Set(shapes.map((s) => s.witness))).toEqual(
      new Set([true, false]),
    );
    expect(new Set(shapes.map((s) => s.layout)).size).toBeGreaterThan(10);
  });

  it('can be solved to an S rating by following its own structure', () => {
    const { caseFile } = buildMysterySkeleton(template, 2024);
    const reach = computeMysteryReachability(caseFile);
    const run = {
      ...createMysteryRun(caseFile, template.scale.action_budget),
      clues: [...reach.clues],
      flags: [...reach.flags],
      firedReactions: caseFile.npcs.flatMap((n) =>
        n.reactions.map((r) => r.id),
      ),
    };
    const result = scoreMysteryRun(caseFile, template, run, {
      who: 'npc_culprit',
      how: 'method_true',
      heir: 'npc_heir',
    });
    expect(result.correct).toEqual({ who: true, how: true, heir: true });
    expect(result.branches).toEqual(['lies_exposed', 'heir_trusted']);
  });

  it('always includes a wrongly suspected NPC who can be cleared', () => {
    for (const seed of seeds) {
      const { caseFile } = buildMysterySkeleton(template, seed);
      const suspect = caseFile.npcs.find((n) => n.role === 'suspect');
      expect(suspect?.reactions[0]).toMatchObject({
        evidenceId: 'clue_suspect',
        effects: [
          { kind: 'reveal_clue', clueId: 'clue_alibi' },
          { kind: 'set_flag', flag: 'suspect_cleared' },
        ],
      });
      expect(caseFile.npcs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not keep the correct method option first for small seeds', () => {
    const firsts = Array.from({ length: 40 }, (_, seed) => {
      const how = buildMysterySkeleton(template, seed).caseFile.questions.find(
        (q) => q.id === 'how',
      )!;
      return how.options![0]!.id;
    });
    expect(firsts.filter((id) => id === 'method_true').length).toBeLessThan(20);
  });

  it('varies how the method is revealed, the sealed room and the answer position', () => {
    const shapes = seeds.map((seed) => {
      const { caseFile } = buildMysterySkeleton(template, seed);
      const how = caseFile.questions.find((q) => q.id === 'how')!;
      return {
        via:
          caseFile.interactions.length > 0
            ? 'tool'
            : caseFile.npcs.find((n) =>
                n.secrets.some((s) => s.clueId === 'clue_method'),
              )!.role,
        sealed: caseFile.rooms.some((r) => r.id === 'room_sealed'),
        answerIndex: how.options!.findIndex((o) => o.id === how.answer),
      };
    });
    expect(new Set(shapes.map((s) => s.via))).toEqual(
      new Set(['tool', 'witness', 'heir']),
    );
    expect(new Set(shapes.map((s) => s.sealed))).toEqual(
      new Set([true, false]),
    );
    expect(new Set(shapes.map((s) => s.answerIndex))).toEqual(
      new Set([0, 1, 2, 3]),
    );
  });
});

describe('mystery dialogue', () => {
  it('drops clues the model tries to reveal before their conditions are met', () => {
    const caseFile = fallback();
    const run = play(caseFile, [{ type: 'move', roomId: 'stone_hall' }]);
    // 尚未到过丹房，韩老三的说法还不能透露；也不能借他之口拿到别处的线索。
    expect(mysteryRevealableSecrets(caseFile, run, 'han')).toEqual([]);
    const result = applyMysteryDialogue(caseFile, run, {
      npcId: 'han',
      question: '你兄长是怎么死的？',
      reply: '兽潮。',
      reveal: ['han_claim', 'poison_ash'],
    });
    expect(result.ok && result.newClues).toEqual([]);
    expect(result.ok && result.run.actionsLeft).toBe(run.actionsLeft - 1);
  });

  it('reveals unlocked secrets, logs both sides and keeps a short memory', () => {
    const caseFile = fallback();
    let run = play(caseFile, [
      { type: 'move', roomId: 'stone_hall' },
      { type: 'move', roomId: 'alchemy' },
      { type: 'move', roomId: 'stone_hall' },
    ]);
    expect(
      mysteryRevealableSecrets(caseFile, run, 'han').map((s) => s.clueId),
    ).toEqual(['han_claim']);
    for (let i = 0; i < 5; i++) {
      const result = applyMysteryDialogue(caseFile, run, {
        npcId: 'han',
        question: `问题${i}`,
        reply: `回答${i}`,
        reveal: ['han_claim'],
      });
      if (!result.ok) throw new Error(result.error);
      if (i === 0) expect(result.newClues).toEqual(['han_claim']);
      else expect(result.newClues).toEqual([]);
      run = result.run;
    }
    expect(run.dialogue?.han.map((d) => d.q)).toEqual([
      '问题1',
      '问题2',
      '问题3',
      '问题4',
    ]);
    expect(run.log.slice(-2)).toEqual([
      { turn: run.turn, kind: 'speech', speaker: '你', text: '问题4' },
      { turn: run.turn, kind: 'speech', speaker: '韩老三', text: '回答4' },
    ]);
  });

  it('requires the person to be present', () => {
    const caseFile = fallback();
    const run = createMysteryRun(caseFile, 30);
    expect(
      applyMysteryDialogue(caseFile, run, {
        npcId: 'su',
        question: '在吗',
        reply: '在',
        reveal: [],
      }),
    ).toEqual({ ok: false, error: '此人不在这里' });
  });
});

describe('mystery hints', () => {
  it('spends an action and points at the most useful thing at hand', () => {
    const caseFile = fallback();
    const run = {
      ...createMysteryRun(caseFile, template.scale.action_budget),
      location: 'stone_hall',
      visited: ['waterfall', 'stone_hall'],
    };
    const result = applyMysteryAction(caseFile, run, { type: 'reflect' });
    expect(result.ok && result.run.actionsLeft).toBe(run.actionsLeft - 1);
    expect(result.ok && result.run.log.at(-1)).toEqual({
      turn: 1,
      kind: 'hint',
      text: '此处的坐化遗骸，值得细看。',
    });
  });

  it('suggests closing the case once nothing useful is left', () => {
    const caseFile = fallback();
    const run = play(caseFile, SOLVE);
    const reach = computeMysteryReachability(caseFile);
    const done = {
      ...run,
      clues: [...reach.clues],
      firedReactions: caseFile.npcs.flatMap((n) =>
        n.reactions.map((r) => r.id),
      ),
      firedInteractions: caseFile.interactions.map((i) => i.id),
      visited: caseFile.rooms.map((r) => r.id),
      items: caseFile.items.map((i) => i.id),
    };
    const result = applyMysteryAction(caseFile, done, { type: 'reflect' });
    expect(result.ok && result.run.log.at(-1)?.text).toBe(
      '眼下的线索已够你推断，不妨翻翻笔记，着手结案。',
    );
  });
});

describe('mystery view for the case board', () => {
  const view = (caseFile: MysteryCaseFile, run: MysteryRunState) =>
    projectMysteryView(
      { templateId: template.id, caseSource: 'fallback', caseFile, run },
      template,
    );

  it('tells where each clue came from and how each person stands', () => {
    const caseFile = fallback();
    const v = view(caseFile, play(caseFile, SOLVE));
    expect(v.clues.every((c) => c.source)).toBe(true);
    const roster = v.clues.find((c) => c.id === 'roster_page')!;
    expect(roster.source).toMatchObject({ kind: 'place', id: 'quiet_room' });
    const pendant = v.clues.find((c) => c.id === 'pendant_match')!;
    expect(pendant.source).toMatchObject({ kind: 'person', id: 'su' });
    const status = Object.fromEntries(v.knownNpcs.map((n) => [n.id, n.status]));
    expect(status).toMatchObject({ han: 'exposed', su: 'opened' });
  });

  it('maps visited rooms and their neighbours, layered from the entrance', () => {
    const caseFile = fallback();
    const v = view(
      caseFile,
      createMysteryRun(caseFile, template.scale.action_budget),
    );
    const start = v.map.rooms.find((r) => r.here)!;
    expect(start).toMatchObject({ id: caseFile.startRoomId, depth: 0 });
    expect(v.map.rooms.filter((r) => r.visited)).toHaveLength(1);
    expect(v.map.rooms.length).toBeGreaterThan(1);
    expect(
      v.map.edges.every(([a, b]) =>
        [a, b].every((id) => v.map.rooms.some((r) => r.id === id)),
      ),
    ).toBe(true);
  });

  it('keeps a warning on screen until the event happens or is prevented', () => {
    const caseFile = fallback();
    const event = caseFile.events![0]!;
    const warned = {
      ...createMysteryRun(caseFile, template.scale.action_budget),
      events: [`warn:${event.id}`],
    };
    expect(view(caseFile, warned).alerts).toEqual([
      { id: event.id, text: event.warning },
    ]);
    expect(
      view(caseFile, { ...warned, flags: ['han_exposed'] }).alerts,
    ).toEqual([]);
    expect(
      view(caseFile, { ...warned, events: [...warned.events, event.id] })
        .alerts,
    ).toEqual([]);
  });
});
