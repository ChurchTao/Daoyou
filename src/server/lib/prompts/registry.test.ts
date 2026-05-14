import { getDivineFortunePrompt } from '@server/utils/divineFortune';
import { getBattleReportPrompt } from '@server/utils/prompts';
import type { LogSpan } from '@shared/engine/battle-v5/systems/log/types';
import {
  getCharacterGenerationPrompt,
  getCharacterGenerationUserPrompt,
} from '@shared/engine/cultivator/creation/prompts';
import {
  getMarketAppraisalPrompt,
  getMarketAppraisalUserPrompt,
} from '@shared/engine/market/appraisal/prompts';
import {
  getMaterialGenerationPrompt,
  getMaterialGenerationUserPrompt,
} from '@shared/engine/material/creation/prompts';
import type { Cultivator } from '@shared/types/cultivator';
import {
  loadPromptTemplateFile,
  parsePromptTemplateMarkdown,
  renderPromptTemplate,
  renderPromptSystem,
  renderPromptUser,
} from './registry';

describe('prompt registry', () => {
  it('renders system and user placeholders', () => {
    const template = parsePromptTemplateMarkdown(
      `id: demo

## system
Hello {{name}}

## user
Value={{value}}
`,
      'inline:demo',
    );

    expect(renderPromptTemplate(template, { name: 'Dao', value: 7 })).toEqual({
      system: 'Hello Dao',
      user: 'Value=7',
    });
  });

  it('throws on missing placeholder variables', () => {
    const template = parsePromptTemplateMarkdown(
      `id: demo

## system
Hello {{name}}
`,
      'inline:demo',
    );

    expect(() => renderPromptTemplate(template, {})).toThrow(
      /模板变量缺失: name/,
    );
  });

  it('can render a single section without validating the other section', () => {
    expect(renderPromptSystem('material-generation')).toContain('材料造化者');
    expect(renderPromptUser('material-generation', { requestList: '1. 灵草' })).toContain(
      '1. 灵草',
    );
  });

  it('validates malformed template files', () => {
    expect(() =>
      parsePromptTemplateMarkdown('## system\nmissing id', 'inline:broken'),
    ).toThrow(/缺少 id 头/);
  });

  it('loads built-in prompt files', () => {
    const template = loadPromptTemplateFile('divine-fortune');
    expect(template.id).toBe('divine-fortune');
    expect(template.system).toContain('今日天机');
  });
});

describe('prompt integrations', () => {
  it('renders divine fortune prompt', () => {
    const [system, user] = getDivineFortunePrompt();
    expect(system).toContain('今日天机');
    expect(user).toContain('新的"今日天机"');
  });

  it('renders material generation prompt with placeholders resolved', () => {
    expect(getMaterialGenerationPrompt()).toContain('材料造化者');

    const user = getMaterialGenerationUserPrompt([
      { type: 'herb', rank: '灵品', quantity: 2, forcedElement: '木' },
    ]);
    expect(user).toContain('【待生成列表】');
    expect(user).toContain('1.');
    expect(user).toContain('指定属性：木');
  });

  it('renders market appraisal prompt payload', () => {
    expect(getMarketAppraisalPrompt()).toContain('坊市大掌柜');

    const user = getMarketAppraisalUserPrompt({
      name: '玄铁',
      type: 'ore',
      rank: '真品',
      element: '金',
      quantity: 3,
      description: '寒气逼人',
      details: { vein: 'north' },
    } as never);
    expect(user).toContain('name: 玄铁');
    expect(user).toContain('"vein":"north"');
  });

  it('renders character generation prompt payload', () => {
    expect(getCharacterGenerationPrompt()).toContain('造化玉碟');

    const user = getCharacterGenerationUserPrompt('寒门剑修');
    expect(user).toContain('寒门剑修');
    expect(user).not.toContain('{{userInput}}');
  });

  it('renders battle report prompt with all dynamic fields', () => {
    const cultivatorBase = {
      id: 'c1',
      name: '韩立',
      realm: '炼气',
      realm_stage: '初期',
      age: 20,
      lifespan: 100,
      gender: 'male',
      origin: '寒门',
      personality: '谨慎',
      background: '散修',
      attributes: {
        vitality: 10,
        spirit: 12,
        wisdom: 15,
        speed: 9,
        willpower: 11,
      },
      spiritual_roots: [{ element: '木', grade: '上品', strength: 80 }],
      cultivations: [
        {
          id: 'g1',
          name: '青元诀',
          description: '',
          level: 1,
          element: '木',
          effects: [],
        },
      ],
      skills: [
        {
          id: 's1',
          name: '风刃术',
          description: '',
          level: 1,
          element: '风',
          damage: 10,
          mana_cost: 5,
          cooldown: 0,
        },
      ],
      pre_heaven_fates: [
        {
          id: 'f1',
          name: '木灵之体',
          description: '亲木',
          rarity: 'rare',
          effects: [],
        },
      ],
      max_skills: 2,
      status: 'active',
      spirit_stones: 0,
      inventory: { artifacts: [], consumables: [], materials: [] },
      equipped: { weapon: null, armor: null, accessory: null },
      prompt: '',
      balance_notes: '',
    } as unknown as Cultivator;
    const opponent = { ...cultivatorBase, id: 'c2', name: '王林' };
    const logSpans = [
      {
        type: 'action',
        turn: 1,
        entries: [{ text: '韩立施展风刃术，造成12点伤害。' }],
      },
    ] as unknown as LogSpan[];

    const [system, user] = getBattleReportPrompt({
      player: cultivatorBase,
      opponent,
      battleResult: {
        winnerId: 'c1',
        turns: 1,
        playerHp: 40,
        opponentHp: 0,
        logSpans,
      },
    });

    expect(system).toContain('分回合的战斗播报');
    expect(user).toContain('韩立');
    expect(user).toContain('王林');
    expect(user).toContain('40');
    expect(user).toContain('第1回合');
  });
});
