import { describe, expect, it } from 'vitest';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { compileCurrentSectCombatV6 } from './index.js';
import { getSectAtlasData, previewSectAtlasBuild, toggleSectAtlasNode } from './atlas.js';

describe('宗门离线图鉴与构筑预览', () => {
  it('包含两条流派的全部授予与被动技能、状态及可独立修改的序列化数据', () => {
    const atlas = getSectAtlasData();
    expect(atlas.sects).toHaveLength(8);
    expect(atlas.limits.meridianCharacterLevels).toEqual([30, 60, 90, 120, 150, 170, 180]);
    for (const sect of atlas.sects) {
      const source = COMBAT_V6_SECT_DEFINITIONS[sect.id];
      const expected = new Set([
        ...source.skills,
        ...source.paths.flatMap(path => [
          ...(path.foundationPassives ?? []), ...(path.grantSkills ?? []),
          ...path.nodes.flatMap(node => [...(node.passives ?? []), ...(node.grantSkills ?? [])]),
        ]),
      ].map(skill => skill.definition.id));
      expect(new Set(sect.skills.map(skill => skill.id))).toEqual(expected);
      expect(sect.statuses).toHaveLength(source.statuses.length);
      expect(sect.statuses.every(status => status.description.length > 0)).toBe(true);
      expect(sect.paths.flatMap(path => path.nodes)).toHaveLength(42);
    }
    expect(JSON.parse(JSON.stringify(atlas))).toEqual(atlas);
    atlas.sects[0].methods[0].name = '修改';
    expect(getSectAtlasData().sects[0].methods[0].name).not.toBe('修改');
    const wuxiang = atlas.sects.find(sect => sect.id === 'wuxiang')!;
    expect(wuxiang.statuses.find(status => status.id === 'wuxiang.status.insight')!.referencedBySkillIds).not.toContain('wuxiang.passive.compassion.5.1');
    expect(wuxiang.statuses.find(status => status.id === 'wuxiang.status.insight_self')!.referencedBySkillIds).toContain('wuxiang.passive.compassion.5.1');
  });

  it('夹取等级、主支心法与解锁深度，拒绝未知或不连通节点而不修改输入', () => {
    const sect = COMBAT_V6_SECT_DEFINITIONS.lingxiao;
    const path = sect.paths[0];
    const node = (layer: number, slot: number) => path.nodes.find(n => n.layer === layer && n.slot === slot)!;
    const input = {
      sectId: sect.id, pathId: path.id, characterLevel: 60,
      methods: { [sect.methods[0].id]: 25, [sect.methods[1].id]: 180 },
      nodeIds: [node(1, 1).id, node(2, 3).id, node(3, 3).id, 'unknown'],
    };
    const before = structuredClone(input);
    const result = previewSectAtlasBuild(input);
    expect(result.ok).toBe(true);
    expect(result.progress.methods[sect.methods[1].id]).toBe(25);
    expect(result.progress.meridianDepth).toBe(2);
    expect(result.selectedNodeIds).toEqual([node(1, 1).id]);
    expect(result.nodeOptions.find(option => option.id === node(3, 3).id)).toMatchObject({ selectable: false });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(input).toEqual(before);
  });

  it('经脉补丁与末层自动奖励使用正式编译结果，切换节点会清除失联后续', () => {
    const sect = COMBAT_V6_SECT_DEFINITIONS.lingxiao;
    const path = sect.paths[0];
    const nodes = path.nodes.filter(node => !node.automatic && node.slot === 2);
    const input = { sectId: sect.id, pathId: path.id, characterLevel: 180, nodeIds: nodes.map(node => node.id) };
    const result = previewSectAtlasBuild(input);
    const compiled = compileCurrentSectCombatV6({ progress: result.progress, characterLevel: result.characterLevel });
    expect(result.ok).toBe(true);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(result.panel).toEqual(compiled.projection.panel);
    expect(result.automaticNodeIds).toEqual(path.nodes.filter(node => node.automatic).map(node => node.id));
    for (const skill of compiled.projection.skills)
      expect(result.skills.find(entry => entry.id === skill.id)).toMatchObject({ available: true, definition: skill });
    expect(result.skills.some(skill => skill.changedFields.length > 0)).toBe(true);
    expect(toggleSectAtlasNode(input, nodes[0].id).selectedNodeIds).toEqual([]);
  });

  it('只计算完整已知的心法表达式，不把缺失的血量、目标、资源或战斗条件当零', () => {
    const sect = COMBAT_V6_SECT_DEFINITIONS.wanqiao;
    const result = previewSectAtlasBuild({ sectId: sect.id, pathId: sect.paths[0].id, characterLevel: 180 });
    const fields = result.skills.flatMap(skill => skill.numericFields);
    const byLevel = fields.filter(field => typeof field.value === 'string' && field.variables.length > 0 && field.variables.every(variable => variable.name === 'skillLevel'));
    expect(byLevel.length).toBeGreaterThan(0);
    expect(byLevel.every(field => field.resolved !== null)).toBe(true);
    const contextual = fields.filter(field => field.variables.some(variable => !['skillLevel', 'level'].includes(variable.name) && !variable.name.startsWith('known.') && !variable.name.startsWith('knownSkillLevel.')));
    expect(contextual.length).toBeGreaterThan(0);
    expect(contextual.every(field => field.resolved === null)).toBe(true);
    expect(contextual.every(field => field.variables.every(variable => variable.label.length > 0))).toBe(true);
    expect(() => previewSectAtlasBuild({ sectId: 'unknown' as never, pathId: '', characterLevel: 180 })).toThrow('未知宗门');
  });

  it('使用正式已知技能集合计算选点概率，并保留百分比、回合和原始数值', () => {
    const sect = COMBAT_V6_SECT_DEFINITIONS.wanqiao;
    const path = sect.paths[0];
    const input = { sectId: sect.id, pathId: path.id, characterLevel: 180 };
    const before = previewSectAtlasBuild(input);
    const after = previewSectAtlasBuild({ ...input, nodeIds: path.nodes.filter(node => node.layer <= 4 && node.slot === 2).map(node => node.id) });
    const chance = (view: typeof before) => view.skills.find(skill => skill.id === 'wanqiao.skill.chorus')!.numericFields.find(field => field.path === 'hooks[1].chance')
      ?? view.skills.find(skill => skill.id === 'wanqiao.skill.chorus')!.numericFields.find(field => typeof field.value === 'string' && field.value.startsWith('(0.02+0.06*'))!;
    expect(chance(before).resolved).toBeCloseTo(0.02);
    expect(chance(after).resolved).toBeCloseTo(0.08);
    expect(chance(after).resolvedDisplay).toBe('8%');
    expect(chance(after).display).toContain('天籁·复音');
    expect(chance(after).display).toContain('入微·复音');
    expect(chance(after).contextLabel).toContain('随机分支');
    expect(after.skills.flatMap(skill => skill.numericFields).some(field => field.label === '冷却回合' && field.display.endsWith('回合'))).toBe(true);
  });

  it('精确区分状态ID、状态种类和本人来源，现场状态仍不参与缺省求值', () => {
    const atlas = getSectAtlasData();
    const beast = atlas.sects.find(sect => sect.id === 'xiaoyue')!;
    const eagle = beast.skills.find(skill => skill.id === 'xiaoyue.skill.eagle_strike')!;
    const labels = new Map(eagle.numericFields.flatMap(field => field.variables.map(variable => [variable.name, variable.label] as const)));
    expect(labels.get('hasStatus.xiaoyue.status.transform')).toBe('是否处于「兽形」');
    expect(labels.get('hasStatus.xiaoyue.status.active_transform_ready')).toBe('是否处于「主动兽形余势」');
    const wanqiao = atlas.sects.find(sect => sect.id === 'wanqiao')!;
    const preview = previewSectAtlasBuild({ sectId: wanqiao.id, pathId: wanqiao.paths[1].id, characterLevel: 180 });
    const fields = preview.skills.flatMap(skill => skill.numericFields);
    const breath = fields.find(field => field.variables.some(variable => variable.name === 'resource.wanqiao.resource.breath'))!;
    expect(breath.variables.find(variable => variable.name === 'resource.wanqiao.resource.breath')!.label).toBe('「窍息」层数');
    expect(breath.resolved).toBeNull();
    const mist = fields.flatMap(field => field.variables).find(variable => variable.name === 'ownedTargetStatusStacks.wanqiao.mist')!;
    expect(mist.label).toBe('目标身上本人施加的「留音」层数');
  });
});
