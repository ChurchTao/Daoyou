import { describe, expect, it } from 'vitest';
import type { CreationProductModel } from '@shared/engine/creation-v2/models/types';
import { CreationTags, GameplayTags } from '@shared/engine/shared/tag-domain';
import type { CultivatorCondition } from '@shared/types/condition';
import {
  detectBodyCultivationCreationRequirements,
  evaluateBodyCultivationCreationPrerequisites,
} from './creationPrerequisites';

function createSkill(overrides: Partial<CreationProductModel> = {}): CreationProductModel {
  return {
    productType: 'skill',
    slug: 'skill-body-test',
    name: '金身雷音拳',
    description: '以肉身脏腑发雷音，震慑敌胆。',
    projectionQuality: '玄品',
    outcomeTags: [],
    affixes: [],
    battleProjection: {
      projectionKind: 'active_skill',
      abilityTags: [],
      mpCost: 1,
      cooldown: 1,
      priority: 1,
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
    },
    ...overrides,
  } as CreationProductModel;
}

function createCondition(args: {
  organs: number;
  primordialSpirit: number;
  realm?: CultivatorCondition['tracks']['bodyCultivation']['realm'];
}): CultivatorCondition {
  return {
    currentHp: 100,
    currentMp: 100,
    statuses: [],
    pillToxicity: {
      current: 0,
      recoveryRate: 0,
    },
    tracks: {
      bodyCultivation: {
        version: 1,
        realm: args.realm ?? 'mortal_body',
        milestones: {},
        tracks: {
          skin: { level: 0, progress: 0 },
          sinew_bone: { level: 0, progress: 0 },
          organs: { level: args.organs, progress: 0 },
          qi_blood: { level: 0, progress: 0 },
          primordial_spirit: { level: args.primordialSpirit, progress: 0 },
        },
      },
      marrow_wash: { level: 0, progress: 0 },
      marrowWash: { level: 0, progress: 0 },
      tempering: {
        vitality: { level: 0, progress: 0 },
        spirit: { level: 0, progress: 0 },
        wisdom: { level: 0, progress: 0 },
        speed: { level: 0, progress: 0 },
        willpower: { level: 0, progress: 0 },
      },
    },
  };
}

describe('body cultivation creation prerequisites', () => {
  it('requires organs and primordial spirit levels for body-cultivation skills', () => {
    const result = evaluateBodyCultivationCreationPrerequisites(
      createCondition({ organs: 6, primordialSpirit: 3 }),
      createSkill(),
    );

    expect(result.applies).toBe(true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('元神 Lv.3/6');
  });

  it('allows body-cultivation skills once both carrying tracks are ready', () => {
    const result = evaluateBodyCultivationCreationPrerequisites(
      createCondition({ organs: 6, primordialSpirit: 6 }),
      createSkill(),
    );

    expect(result).toMatchObject({
      applies: true,
      allowed: true,
      reason: undefined,
    });
  });

  it('does not gate ordinary non-body skills', () => {
    const result = evaluateBodyCultivationCreationPrerequisites(
      createCondition({ organs: 0, primordialSpirit: 0 }),
      createSkill({
        name: '青木回元术',
        description: '以木气回元疗伤。',
      }),
    );

    expect(result).toEqual({
      applies: false,
      allowed: true,
      requirements: [],
    });
  });

  it('does not gate ordinary physical-channel elemental skills without body signals', () => {
    const product = createSkill({
      name: '风刃术',
      description: '凝风成刃，斩向敌手。',
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
          GameplayTags.ABILITY.ELEMENT.WIND,
        ],
        mpCost: 1,
        cooldown: 1,
        priority: 1,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [],
      },
      affixes: [
        {
          id: 'skill-core-damage-wind',
          name: '风系伤害',
          description: '施放时造成一次风系物理伤害',
          category: 'skill_core',
          match: {
            any: [
              CreationTags.MATERIAL.SEMANTIC_WIND,
              CreationTags.MATERIAL.SEMANTIC_BURST,
            ],
          },
          tags: [
            CreationTags.MATERIAL.SEMANTIC_WIND,
            CreationTags.MATERIAL.SEMANTIC_BURST,
          ],
          weight: 1,
          energyCost: 1,
          effectTemplate: {
            type: 'damage',
            params: { value: { base: 1 } },
          },
          rollScore: 1,
          rollEfficiency: 1,
          finalMultiplier: 1,
          isPerfect: false,
        },
      ],
    });

    expect(detectBodyCultivationCreationRequirements(product)).toEqual([]);
    expect(
      evaluateBodyCultivationCreationPrerequisites(
        createCondition({ organs: 0, primordialSpirit: 0 }),
        product,
      ),
    ).toEqual({
      applies: false,
      allowed: true,
      requirements: [],
    });
  });

  it('detects body-skill carrying requirements from structured affix tags', () => {
    const product = createSkill({
      name: '玄金战锋',
      description: '凝金煞成锋，近身爆发。',
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ],
        mpCost: 1,
        cooldown: 1,
        priority: 1,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [],
      },
      affixes: [
        {
          id: 'skill-rare-metal-warform',
          name: '战锋',
          description: '施放时提升自身攻击与暴击率',
          category: 'skill_rare',
          match: {
            any: [
              CreationTags.MATERIAL.SEMANTIC_BLOOD,
              CreationTags.MATERIAL.SEMANTIC_BONE,
            ],
          },
          tags: [
            CreationTags.MATERIAL.SEMANTIC_BLOOD,
            CreationTags.MATERIAL.SEMANTIC_BONE,
          ],
          weight: 1,
          energyCost: 1,
          effectTemplate: {
            type: 'damage',
            params: { value: { base: 1 } },
          },
          rollScore: 1,
          rollEfficiency: 1,
          finalMultiplier: 1,
          isPerfect: false,
        },
      ],
    });

    expect(detectBodyCultivationCreationRequirements(product)).toEqual([
      { kind: 'track', track: 'organs', requiredLevel: 6 },
    ]);
    const result = evaluateBodyCultivationCreationPrerequisites(
      createCondition({ organs: 3, primordialSpirit: 0 }),
      product,
    );

    expect(result).toMatchObject({
      applies: true,
      allowed: false,
      reason: '肉身神通承载不足：脏腑 Lv.3/6',
    });
  });

  it('detects soul-body requirements from true-damage spirit signals', () => {
    const product = createSkill({
      name: '玄冥断魄',
      description: '凝阴煞直入神魂。',
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.TRUE,
        ],
        mpCost: 1,
        cooldown: 1,
        priority: 1,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [],
      },
      affixes: [
        {
          id: 'skill-rare-soul-rend',
          name: '魂伤',
          description: '施放时造成一次真实伤害',
          category: 'skill_rare',
          match: {
            all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
            any: [CreationTags.MATERIAL.SEMANTIC_DIVINE],
          },
          tags: [
            CreationTags.MATERIAL.SEMANTIC_SPIRIT,
            CreationTags.MATERIAL.SEMANTIC_DIVINE,
          ],
          grantedAbilityTags: [GameplayTags.ABILITY.CHANNEL.TRUE],
          weight: 1,
          energyCost: 1,
          effectTemplate: {
            type: 'damage',
            params: { value: { base: 1 } },
          },
          rollScore: 1,
          rollEfficiency: 1,
          finalMultiplier: 1,
          isPerfect: false,
        },
      ],
    });

    expect(detectBodyCultivationCreationRequirements(product)).toEqual([
      { kind: 'track', track: 'primordial_spirit', requiredLevel: 6 },
    ]);
    const result = evaluateBodyCultivationCreationPrerequisites(
      createCondition({ organs: 0, primordialSpirit: 4 }),
      product,
    );

    expect(result).toMatchObject({
      applies: true,
      allowed: false,
      reason: '肉身神通承载不足：元神 Lv.4/6',
    });
  });

  it('requires dharma body and stronger carrying tracks for high-tier body skills', () => {
    const product = createSkill({
      name: '法身雷音拳',
      description: '身神合一后以法身承载雷音，震碎敌胆。',
    });

    expect(detectBodyCultivationCreationRequirements(product)).toEqual([
      { kind: 'realm', realm: 'dharma_body' },
      { kind: 'track', track: 'organs', requiredLevel: 18 },
      { kind: 'track', track: 'primordial_spirit', requiredLevel: 18 },
    ]);

    const blocked = evaluateBodyCultivationCreationPrerequisites(
      createCondition({
        realm: 'golden_body',
        organs: 18,
        primordialSpirit: 18,
      }),
      product,
    );

    expect(blocked).toMatchObject({
      applies: true,
      allowed: false,
      reason: '肉身神通承载不足：肉身阶位 金身/法身',
    });

    const allowed = evaluateBodyCultivationCreationPrerequisites(
      createCondition({
        realm: 'dharma_body',
        organs: 18,
        primordialSpirit: 18,
      }),
      product,
    );

    expect(allowed).toMatchObject({
      applies: true,
      allowed: true,
      reason: undefined,
    });
  });
});
