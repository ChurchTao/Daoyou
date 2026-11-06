import { describe, expect, it } from 'vitest';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { compileCurrentSectCombatV6 } from './index.js';
import { getSectAtlasData, previewSectAtlasBuild, previewSectAtlasSkill, toggleSectAtlasNode } from './atlas.js';

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

  it('将概率加值显示为带符号的百分比，保留现场计算表达式', () => {
    const atlas = getSectAtlasData();
    const lingxiao = atlas.sects.find(sect => sect.id === 'lingxiao')!;
    const crit = lingxiao.skills.find(skill => skill.id === 'lingxiao.passive.zhanchen.n3_2')!
      .numericFields.find(field => field.path.endsWith('.critChanceAdd'));
    expect(crit).toMatchObject({ value: 0.15, display: '+15%', resolvedDisplay: '+15%' });

    const youdu = atlas.sects.find(sect => sect.id === 'youdu')!;
    const seal = youdu.skills.find(skill => skill.id === 'youdu.passive.soul_seek')!
      .numericFields.find(field => field.path.endsWith('.sealChanceAdd'));
    expect(seal).toMatchObject({ display: '(较小值(当前回合 * 0.005, 0.12)) × 100%', resolvedDisplay: null });
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

  it('独立预览心法成长，保留原始表达式、单位及解锁门槛', () => {
    const eagle = (methodLevel: number) => previewSectAtlasSkill({ sectId: 'xiaoyue', skillId: 'xiaoyue.skill.eagle_strike', methodLevel });
    const low = eagle(75);
    const high = eagle(180);
    const target = (result: typeof low) => result.numericFields.find(field => field.path === 'targeting.count')!;
    expect(low).toMatchObject({ sourceMethodId: 'xiaoyue.method.onslaught', methodLevel: 75, unlockMethodLevel: 30, unlocked: true });
    expect(target(low)).toMatchObject({ resolved: 5, resolvedDisplay: '5个目标' });
    expect(target(high)).toMatchObject({ resolved: 6, resolvedDisplay: '6个目标' });
    expect(target(low).value).toBe(target(high).value);
    expect(target(low).display).toBe(target(high).display);
    expect(target(low).contextLabel).toBe('基础参数 / 作用目标');
    expect(high.numericFields.find(field => field.path === 'effects[0].chance')).toMatchObject({ value: 0.3, resolved: 0.3, display: '30%', resolvedDisplay: '30%' });
    expect(eagle(0)).toMatchObject({ methodLevel: 0, unlocked: false });
    const guardian = (methodLevel: number) => previewSectAtlasSkill({ sectId: 'jiujie', skillId: 'jiujie.skill.divine_guardian', methodLevel }).numericFields.find(field => field.path === 'effects[0].duration')!;
    expect(guardian(75).resolvedDisplay).toBe('4回合');
    expect(guardian(180).resolvedDisplay).toBe('7回合');
  });

  it('可查流派与节点授予神通，但不套用流派或节点补丁', () => {
    const pathSkill = previewSectAtlasSkill({ sectId: 'jiujie', skillId: 'jiujie.skill.thunderstorm', methodLevel: 75 });
    const nodeSkill = previewSectAtlasSkill({ sectId: 'jiujie', skillId: 'jiujie.skill.absorb', methodLevel: 75 });
    expect(pathSkill.sourceMethodId).toBe('jiujie.method.thunder');
    expect(pathSkill.numericFields.find(field => field.path === 'effects[0].power')?.resolved).toBe(112.5);
    expect(nodeSkill.numericFields.find(field => field.path === 'effects[3].power')?.resolved).toBe(112.5);
    const sect = COMBAT_V6_SECT_DEFINITIONS.lingxiao;
    const path = sect.paths[0];
    const compiled = previewSectAtlasBuild({ sectId: sect.id, pathId: path.id, characterLevel: 180, nodeIds: path.nodes.filter(node => !node.automatic && node.slot === 2).map(node => node.id) });
    expect(compiled.skills.find(skill => skill.id === 'lingxiao.skill.waiting')!.numericFields.find(field => field.path === 'costHp')?.resolved).toBe(0);
    expect(previewSectAtlasSkill({ sectId: sect.id, skillId: 'lingxiao.skill.waiting', methodLevel: 180 }).numericFields.find(field => field.path === 'costHp')).toMatchObject({ value: 'hp * 0.05', resolved: null });
  });

  it('按施放心法等级计算直接施加状态，不把使用条件中的状态当成本技能加成', () => {
    const transform = (methodLevel: number) => previewSectAtlasSkill({ sectId: 'xiaoyue', skillId: 'xiaoyue.skill.transform', methodLevel });
    const physicalAttack = (methodLevel: number) => transform(methodLevel).numericFields.find(field => field.path === 'effects[1].statuses.xiaoyue.status.transform.attrMods.physicalAtk')!;
    expect(physicalAttack(75)).toMatchObject({ value: 'skillLevel', resolved: 75, resolvedDisplay: '75' });
    expect(physicalAttack(180).resolved).toBe(180);
    expect(physicalAttack(75).contextLabel).toContain('施加状态·兽形');
    expect(transform(75).numericFields.find(field => field.path === 'effects[1].duration')?.resolvedDisplay).toBe('4回合');
    expect(previewSectAtlasSkill({ sectId: 'xiaoyue', skillId: 'xiaoyue.skill.eagle_strike', methodLevel: 75 }).numericFields.some(field => field.path.includes('statuses.xiaoyue.status.transform.'))).toBe(false);
  });

  it('惊雷自然转为蓄势状态时沿用施放心法等级计算成长', () => {
    const waiting = (methodLevel: number) => previewSectAtlasSkill({ sectId: 'lingxiao', skillId: 'lingxiao.skill.waiting', methodLevel });
    const physicalAttack = (methodLevel: number) => waiting(methodLevel).numericFields.find(field => field.path.endsWith('statuses.lingxiao.status.waiting.attrMods.physicalAtk'))!;
    expect(physicalAttack(75)).toMatchObject({ value: 'skillLevel', resolved: 75 });
    expect(physicalAttack(180).resolved).toBe(180);
    expect(physicalAttack(75).contextLabel).toContain('自然转为·惊雷');
    expect(waiting(75).numericFields.find(field => field.path.endsWith('statuses.lingxiao.status.waiting.speedMod'))?.resolved).toBe(150);
  });

  it('零级心法的零级门槛与正式编译一致，门槛标记不代替流派或节点选择', () => {
    const sect = COMBAT_V6_SECT_DEFINITIONS.xiaoyue;
    const compiled = previewSectAtlasBuild({ sectId: sect.id, pathId: sect.paths[0].id, characterLevel: 180, methods: Object.fromEntries(sect.methods.map(method => [method.id, 0])) });
    expect(compiled.ok).toBe(true);
    expect(compiled.skills.find(skill => skill.id === 'xiaoyue.skill.foundation')?.available).toBe(true);
    expect(previewSectAtlasSkill({ sectId: sect.id, skillId: 'xiaoyue.skill.foundation', methodLevel: 0 })).toMatchObject({ methodLevel: 0, unlockMethodLevel: 0, unlocked: true });
  });

  it('复用正式师门项公式展示心法附加威力，原始系数仍保留', () => {
    const power = (methodLevel: number) => previewSectAtlasSkill({ sectId: 'bailu', skillId: 'bailu.skill.poxie', methodLevel });
    expect(power(75).numericFields.find(field => field.path === 'schoolTerm.total')).toMatchObject({ resolved: 189.375, resolvedDisplay: '189.375', variables: [{ name: 'skillLevel', label: '所属心法等级' }] });
    expect(power(180).numericFields.find(field => field.path === 'schoolTerm.total')?.resolved).toBe(570);
    expect(power(75).numericFields.find(field => field.path === 'schoolTerm.linear')).toMatchObject({ value: 1.5, resolved: 1.5 });
  });

  it('独立预览不假设人物等级、已学技能、属性或现场状态', () => {
    const atlas = getSectAtlasData();
    let contextualFields = 0;
    for (const sect of atlas.sects) {
      for (const skill of sect.skills) {
        const result = previewSectAtlasSkill({ sectId: sect.id, skillId: skill.id, methodLevel: 75 });
        for (const field of result.numericFields) {
          if (field.variables.some(variable => variable.name !== 'skillLevel') || (field.variables.length && field.contextLabel.includes('按触发技能等级'))) {
            contextualFields++;
            expect(field.resolved, `${skill.id}:${field.path}`).toBeNull();
            expect(field.resolvedDisplay).toBeNull();
          } else expect(field.resolved, `${skill.id}:${field.path}`).not.toBeNull();
        }
      }
    }
    expect(contextualFields).toBeGreaterThan(0);
  });

  it.each([[-1, 0], [75.9, 75], [999, 180], [NaN, 0], [Infinity, 0]])('将独立心法等级 %s 规范为 %s', (input, expected) => {
    expect(previewSectAtlasSkill({ sectId: 'xiaoyue', skillId: 'xiaoyue.skill.eagle_strike', methodLevel: input }).methodLevel).toBe(expected);
  });

  it('拒绝未知宗门与跨宗门神通，不依靠心法等级掩盖错误引用', () => {
    expect(() => previewSectAtlasSkill({ sectId: 'unknown' as never, skillId: 'xiaoyue.skill.eagle_strike', methodLevel: 180 })).toThrow('未知宗门');
    expect(() => previewSectAtlasSkill({ sectId: 'jiujie', skillId: 'xiaoyue.skill.eagle_strike', methodLevel: 180 })).toThrow('神通不属于当前宗门');
  });
});
