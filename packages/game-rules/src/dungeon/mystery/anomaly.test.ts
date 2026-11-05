import { getMysteryTemplate } from '@daoyou/game-content/dungeon/scenarios';
import type {
  MysteryCaseFile,
  MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';
import { describe, expect, it } from 'vitest';
import { applyMysteryAction, createMysteryRun } from './engine.js';
import { projectMysteryView } from './projection.js';
import { mysteryConfrontationTarget } from './scoring.js';
import { buildMysterySkeleton } from './skeleton.js';
import {
  estimateMysteryMinimumActions,
  validateMysteryCase,
} from './validate.js';

const template = getMysteryTemplate('anomaly_source')!;
const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 5);

const look = (caseFile: MysteryCaseFile, run: MysteryRunState) => {
  const result = applyMysteryAction(caseFile, run, {
    type: 'search',
    objectId: 'obj_symptom_near',
  });
  if (!result.ok) throw new Error(result.error);
  return result.run;
};

const inHub = (caseFile: MysteryCaseFile): MysteryRunState => ({
  ...createMysteryRun(caseFile, template.scale.action_budget),
  location: 'room_hub',
  visited: [caseFile.startRoomId, 'room_hub'],
});

describe('anomaly skeleton', () => {
  it('produces valid, solvable cases for every seed', () => {
    const sage = new Set<boolean>();
    for (const seed of seeds) {
      const { caseFile } = buildMysterySkeleton(template, seed);
      expect(validateMysteryCase(caseFile, template), `seed ${seed}`).toEqual(
        [],
      );
      expect(estimateMysteryMinimumActions(caseFile)).toBeLessThanOrEqual(
        template.scale.action_budget * 0.75,
      );
      sage.add(caseFile.npcs.some((n) => n.role === 'sage'));
    }
    expect(sage.size).toBe(2);
  });
});

describe('anomaly variants', () => {
  it('mixes in the unwitting variant, where the honest local caused it', () => {
    let unwitting = 0;
    for (const seed of seeds) {
      const { caseFile } = buildMysterySkeleton(template, seed);
      const culprit = caseFile.questions.find((q) => q.id === 'culprit')!;
      const liar = caseFile.npcs.find((n) =>
        n.reactions.some((r) => r.exposesLie),
      )!;
      if (caseFile.variant === 'unwitting') {
        unwitting++;
        expect(culprit.answer).toBe('npc_local');
        expect(liar.id).not.toBe(culprit.answer);
      } else expect(liar.id).toBe(culprit.answer);
    }
    expect(unwitting).toBeGreaterThan(90);
  });
});

describe('anomaly escalation', () => {
  it('seals a side room at the first stage and blocks moving in', () => {
    const { caseFile } = buildMysterySkeleton(template, 9);
    const stage = caseFile.events!.find((e) => e.id === 'evt_stage_1')!;
    const sealed = (stage.effects[0] as { roomId: string }).roomId;
    const run = look(caseFile, {
      ...inHub(caseFile),
      actionsLeft: template.scale.action_budget - stage.at,
    });
    expect(run.sealedRooms).toEqual([sealed]);
    const parent = caseFile.rooms.find((r) => r.exits.includes(sealed))!;
    const there = {
      ...run,
      location: parent.id,
      visited: [...run.visited, parent.id],
    };
    expect(
      applyMysteryAction(caseFile, there, { type: 'move', roomId: sealed }),
    ).toMatchObject({ ok: false });
    const view = projectMysteryView(
      { templateId: template.id, caseSource: 'fallback', caseFile, run: there },
      template,
    );
    expect(view.map.rooms.find((r) => r.id === sealed)?.sealed).toBe(true);
    expect(view.exits.find((e) => e.id === sealed)).toMatchObject({
      locked: true,
      hint: '已被异变封住，进不去了。',
    });
  });

  it('reports escalation, the coming omen and what was lost to the player', () => {
    const { caseFile } = buildMysterySkeleton(template, 9);
    const [s1, s2] = caseFile.events!;
    const view = (run: MysteryRunState) =>
      projectMysteryView(
        { templateId: template.id, caseSource: 'fallback', caseFile, run },
        template,
      );
    let run = look(caseFile, {
      ...inHub(caseFile),
      actionsLeft: template.scale.action_budget - s1!.at,
    });
    expect(view(run).anomaly).toEqual({
      stage: 1,
      stages: 3,
      contained: false,
    });
    run = look(caseFile, {
      ...run,
      actionsLeft: template.scale.action_budget - s2!.warnAt,
    });
    expect(run.log.at(-1)).toMatchObject({ kind: 'omen' });
    expect(view(run).alerts).toEqual([
      { id: s2!.id, text: s2!.warning, turnsLeft: s2!.at - s2!.warnAt },
    ]);
    run = look(caseFile, {
      ...run,
      actionsLeft: template.scale.action_budget - s2!.at,
    });
    expect(view(run).anomaly?.stage).toBe(2);
    const evidence = caseFile.objects.find((o) => o.id === 'obj_evidence')!;
    expect(view(run).lost).toEqual([]);
    expect(
      view({ ...run, visited: [...run.visited, evidence.roomId] }).lost,
    ).toEqual([evidence.name]);
  });

  it('stops escalating once the ward is used on the source', () => {
    const { caseFile } = buildMysterySkeleton(template, 9);
    const stage = caseFile.events!.find((e) => e.id === 'evt_stage_1')!;
    const run = look(caseFile, {
      ...inHub(caseFile),
      actionsLeft: template.scale.action_budget - stage.at,
      flags: ['anomaly_contained'],
    });
    expect(run.sealedRooms).toBeUndefined();
    expect(run.events ?? []).toEqual([]);
  });
});

describe('anomaly finale', () => {
  it('pits you against the manifestation when source and remedy are right', () => {
    const { caseFile } = buildMysterySkeleton(template, 3);
    const solved = {
      source: 'source_true',
      culprit: 'npc_culprit',
      remedy: 'remedy_true',
    };
    expect(
      mysteryConfrontationTarget(caseFile, template, solved),
    ).toMatchObject({ id: 'manifest', role: 'manifest' });
    expect(
      mysteryConfrontationTarget(caseFile, template, {
        ...solved,
        remedy: 'remedy_force',
      }),
    ).toBeNull();
  });
});
