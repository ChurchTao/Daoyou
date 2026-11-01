import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import combat from './data/wanqiao-combat.json' with { type: 'json' };
import paths from './data/wanqiao-paths.json' with { type: 'json' };
import combatSchema from './data/wanqiao-combat.schema.json' with { type: 'json' };
import pathsSchema from './data/wanqiao-paths.schema.json' with { type: 'json' };
import { loadWanqiaoCombatPack, WanqiaoCombatPackShape, WANQIAO_COMBAT } from './wanqiao-pack.js';
import { loadWanqiaoPathsPack, WanqiaoPathsPackShape, WANQIAO_PATHS } from './wanqiao-path-pack.js';

describe('万窍山首版内容契约', () => {
  it('保持严格JSON Schema与两条完整经脉，不开放治疗流或待核花语', () => {
    expect(z.toJSONSchema(WanqiaoCombatPackShape, { reused: 'ref' })).toEqual(combatSchema);
    expect(z.toJSONSchema(WanqiaoPathsPackShape, { reused: 'ref' })).toEqual(pathsSchema);
    expect(WANQIAO_PATHS.map(path => path.name)).toEqual(['天籁', '入微']);
    for (const path of WANQIAO_PATHS) {
      expect(path.nodes).toHaveLength(21);
      expect(path.nodes.filter(node => node.automatic).map(node => [node.layer, node.slot])).toEqual([[7, 1], [7, 3]]);
      expect(path.nodes.filter(node => !node.automatic)).toHaveLength(19);
    }
    expect(WANQIAO_COMBAT.skills).toHaveLength(15);
    expect(WANQIAO_COMBAT.skills.some(skill => /flower|herb|healer/.test(skill.definition.id))).toBe(false);
    expect(WANQIAO_COMBAT.statuses.find(status => status.id === 'wanqiao.status.echo')).toMatchObject({ sourceBound: true, maxStacks: 3 });
  });

  it('拒绝重复ID、缺失技能／状态引用与未知公式', () => {
    const duplicate = structuredClone(combat);
    duplicate.skills[1].id = duplicate.skills[0].id;
    expect(() => loadWanqiaoCombatPack(duplicate)).toThrow('重复 ID');
    const missing = structuredClone(combat);
    missing.baseSkillIds.push('wanqiao.skill.missing');
    expect(() => loadWanqiaoCombatPack(missing)).toThrow('技能引用不存在');
    const reference = structuredClone(combat);
    reference.statuses.find(status => status.id === 'wanqiao.status.freeze_pending')!.onExpire!.statusId = 'wanqiao.status.missing';
    expect(() => loadWanqiaoCombatPack(reference)).toThrow('引用不存在');
    const formula = structuredClone(combat);
    formula.skills[0].costMp = 'unverifiedCoefficient*targets';
    expect(() => loadWanqiaoCombatPack(formula)).toThrow('未知表达式');
    const known = structuredClone(combat);
    known.skills[0].costMp = '30+known.wanqiao.passive.missing';
    expect(() => loadWanqiaoCombatPack(known)).toThrow('引用不存在');
  });

  it('拒绝错位自动奖励及无效果节点', () => {
    const automatic = structuredClone(paths);
    automatic.paths[0].nodes[0].automatic = true;
    expect(() => loadWanqiaoPathsPack(automatic)).toThrow('末端奖励位置不正确');
    const empty = structuredClone(paths);
    empty.paths[0].nodes[0].passives = [];
    expect(() => loadWanqiaoPathsPack(empty)).toThrow('经脉节点缺少实际效果');
  });

  it('拒绝未知面板来源、重复坐标及不存在的节点被动', () => {
    const unknownFact = structuredClone(paths);
    const pure = unknownFact.paths[0].nodes.find(node => node.id.endsWith('.chunjing'))!;
    pure.panel![0].sourceFact = 'unknownMaxHp';
    expect(() => loadWanqiaoPathsPack(unknownFact)).toThrow('sourceFact');
    const coordinates = structuredClone(paths);
    coordinates.paths[0].nodes[1].slot = coordinates.paths[0].nodes[0].slot;
    expect(() => loadWanqiaoPathsPack(coordinates)).toThrow('层级槽位重复');
    const passive = structuredClone(paths);
    passive.paths[0].nodes[0].passives = ['wanqiao.passive.missing'];
    expect(() => loadWanqiaoPathsPack(passive)).toThrow('引用不存在');
  });

  it('拒绝非法数值边界及越权覆盖技能心法归属', () => {
    const resource = structuredClone(combat);
    resource.resources[0].current = resource.resources[0].max + 1;
    expect(() => loadWanqiaoCombatPack(resource)).toThrow('初始资源超过上限');
    const probability = structuredClone(combat);
    const branch = probability.skills[0].effects.find(effect => effect.type === 'randomBranch')!;
    branch.chance = 2;
    expect(() => loadWanqiaoCombatPack(probability)).toThrow('chance');
    const cost = structuredClone(combat);
    cost.skills[0].costMp = -30;
    expect(() => loadWanqiaoCombatPack(cost)).toThrow('costMp');
    expect(() => loadWanqiaoCombatPack({ ...combat, skills: [{ ...combat.skills[0], sourceMethodId: 'bailu.method.canon' }, ...combat.skills.slice(1)] })).toThrow('sourceMethodId');
  });
});
