import { CreationOrchestrator } from '../../CreationOrchestrator';
import { CreationSessionInput } from '../../types';

/**
 * 造物引擎 V2 真实天道预览 (End-to-End)
 * 增加详细能量审计与词条数据打印
 */
const printOutcome = (title: string, session: any) => {
  const model = session.state.blueprint.productModel;
  const outcome = session.state.outcome;
  const budget = session.state.energyBudget;

  console.log(`\n================================================================`);
  console.log(`=== 【${title}】 深度技术预览 ===`);
  console.log(`================================================================`);
  console.log(`名称: ${model.name} (${model.originalName || '无初名'})`);
  console.log(`描述: ${model.description}`);
  
  if (session.state.namingMetadata) {
    console.log(`天道感悟: ${session.state.namingMetadata.styleInsight || '无'}`);
  }

  console.log(`\n--- 能量审计 (Energy Ledger) ---`);
  console.log(`总灵能强度 (Effective Total): ${budget.effectiveTotal}`);
  console.log(`  - 基础预留 (Reserved):     ${budget.reserved} (用于维持产物基本形态)`);
  console.log(`  - 词条消耗 (Spent):        ${budget.spent} (用于抽取与强化词条)`);
  console.log(`  - 剩余灵能 (Remaining):    ${budget.remaining} (溢散或转化为基础属性)`);
  console.log(`能量来源: ${budget.sources.map((s: any) => `${s.source}(${s.amount})`).join(', ')}`);

  console.log(`\n--- 词条完整数据 (Affix Full Data) ---`);
  model.affixes.forEach((a: any, idx: number) => {
    const perf = a.isPerfect ? ' ★极品★' : '';
    console.log(`[词条 #${idx + 1}] ${a.name} (ID: ${a.id})`);
    console.log(`  - 类别: ${a.category} | 稀有度: ${a.rarity || 'common'}`);
    console.log(`  - 能量权重: 消耗 ${a.energyCost} | 随机权重 ${a.weight}`);
    console.log(`  - 数值灵魂: 效率 ${Math.round(a.rollEfficiency * 100)}% | 最终倍率 x${a.finalMultiplier.toFixed(2)}${perf}`);
    console.log(`  - 逻辑模板 (EffectTemplate): ${JSON.stringify(a.effectTemplate)}`);
    if (a.grantedAbilityTags) console.log(`  - 赋予能力标签: ${a.grantedAbilityTags.join(', ')}`);
  });

  console.log(`\n--- 战斗投影 (AbilityConfig) ---`);
  const ability = outcome.ability;
  console.log(`  - 类型: ${ability.type} | Slug: ${ability.slug}`);
  const tags = Array.isArray(ability.tags) ? ability.tags : Array.from(ability.tags || []);
  console.log(`  - 最终标签: ${tags.join(', ')}`);
  
  if (ability.mpCost) console.log(`  - 灵力消耗: ${ability.mpCost}`);
  if (ability.cooldown) console.log(`  - 冷却回合: ${ability.cooldown}`);
  
  if (ability.modifiers && ability.modifiers.length > 0) {
    console.log(`  - 属性修正列表:`);
    ability.modifiers.forEach((m: any) => console.log(`    * [${m.attrType}] 模式:${m.type} 数值:${m.value.toFixed(2)}`));
  }
  
  if (ability.effects && ability.effects.length > 0) {
    console.log(`  - 实时效果列表 (Direct Effects):`);
    ability.effects.forEach((e: any) => console.log(`    * 类型:${e.type} 参数:${JSON.stringify(e.params)}`));
  }
  console.log(`================================================================\n`);
};

describe('造物引擎 V2 真实天道预览 - 深度审计版', () => {
  let orchestrator: CreationOrchestrator;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENABLE_LLM_NAMING = 'true';
    orchestrator = new CreationOrchestrator();
  });

  jest.setTimeout(40000);

  it.skip('审计：招式炼制', async () => {
    const input: CreationSessionInput = {
      sessionId: 'audit-skill',
      productType: 'skill',
      materials: [
        { id: 'm1', name: '赤炎精铁', type: 'ore', rank: '真品', quantity: 2, element: '火' },
        { id: 'm2', name: '雷髓残核', type: 'monster', rank: '玄品', quantity: 1, element: '雷' }
      ],
      userPrompt: '雷火合一的攻击秘剑'
    };

    const session = await orchestrator.craftAsync(input, { autoMaterialize: true });
    printOutcome('审计-主动技能', session);
  });

  it.skip('审计：法宝炼制', async () => {
    const input: CreationSessionInput = {
      sessionId: 'audit-artifact',
      productType: 'artifact',
      requestedSlot: 'weapon',
      materials: [
        { id: 'm3', name: '玄金精矿', type: 'ore', rank: '地品', quantity: 2, element: '金' },
        { id: 'm4', name: '大妖断角', type: 'monster', rank: '天品', quantity: 2 }
      ]
    };

    const session = await orchestrator.craftAsync(input, { autoMaterialize: true });
    printOutcome('审计-攻击法宝', session);
  });
});
