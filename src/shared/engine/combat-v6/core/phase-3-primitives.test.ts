import { describe, expect, it } from "vitest"
import {
  COMBAT_V6_PHASE_1_VERSIONS,
  CommandType,
  EffectType,
  EventType,
  HookName,
  HpZeroOutcome,
  SkillTag,
  TargetSide,
  createBattle,
  type Ruleset,
  type SkillDef,
} from "../index.ts"

const ruleset: Ruleset = {
  name: "phase-3-primitives",
  maxRounds: 10,
  formulas: {
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    critMultiplier: 2,
    furyAtkMultiplier: 1,
    defendPhysicalFactor: 0.5,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense, power) => Math.max(1, attack - defense + power),
    baseDamage: ({ source, target, coeff, power }) =>
      Math.max(1, (source.attrs.physicalAtk - target.attrs.physicalDef) * coeff + power),
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    sealHitChance: () => 1,
    fleeChance: () => 0,
  },
  hpZeroOutcome: () => HpZeroOutcome.Dead,
  decideCommand: ({ enemies }) =>
    enemies[0]
      ? { type: CommandType.Attack, target: enemies[0].id }
      : { type: CommandType.Defend },
}

function skill(overrides: Partial<SkillDef> = {}): SkillDef {
  return {
    id: "resource-strike",
    name: "资源打击",
    tags: [SkillTag.Physical],
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.PhysicalHit, coeff: 1, defenseIgnore: 0.5 },
      { type: EffectType.ModifyResource, resourceId: "sword_intent", amount: 2 },
    ],
    ...overrides,
  }
}

function battleWith(skillDef = skill()) {
  return createBattle({
    seed: 1,
    versions: COMBAT_V6_PHASE_1_VERSIONS,
    ruleset,
    skills: [skillDef],
    units: [
      {
        id: "source",
        name: "source",
        side: 0,
        kind: "player",
        skills: [skillDef.id],
        resources: [{ id: "sword_intent", name: "剑意", current: 10, max: 11 }],
        attrs: { hp: 100, speed: 10, physicalAtk: 100, physicalDef: 0 },
      },
      {
        id: "target",
        name: "target",
        side: 1,
        kind: "npc",
        attrs: { hp: 200, speed: 1, physicalAtk: 1, physicalDef: 40 },
      },
    ],
  })
}

describe("combat-v6 phase 3 generic primitives", () => {
  it("prechecks aggregated resource costs, falls back, and emits successful deductions", () => {
    const costly = skill({
      id: "costly",
      resourceCosts: [
        { resourceId: "sword_intent", amount: 3 },
        { resourceId: "sword_intent", amount: 4 },
      ],
      effects: [{ type: EffectType.PhysicalHit, coeff: 2 }],
    })
    const failed = battleWith(costly)
    failed.unit("source").resources[0]!.current = 6
    failed.submit("source", { type: CommandType.Skill, skillId: costly.id, targets: ["target"] })
    failed.submit("target", { type: CommandType.Defend })
    failed.lockAndResolve()
    expect(failed.log()).toContainEqual({ type: EventType.ActionFailed, unitId: "source", reason: "resource-requirement:sword_intent" })
    expect(failed.unit("source").resources[0]?.current).toBe(6)

    const succeeded = battleWith(costly)
    succeeded.submit("source", { type: CommandType.Skill, skillId: costly.id, targets: ["target"] })
    succeeded.submit("target", { type: CommandType.Defend })
    succeeded.lockAndResolve()
    expect(succeeded.unit("source").resources[0]?.current).toBe(3)
    expect(succeeded.log()).toContainEqual({
      type: EventType.ResourceChanged,
      sourceId: "source",
      unitId: "source",
      resourceId: "sword_intent",
      before: 10,
      after: 3,
    })
  })

  it("exposes actual hp loss and caps repeated gains within one action", () => {
    const capped = skill({
      id: "capped",
      effects: [
        { type: EffectType.ModifyResource, resourceId: "sword_intent", amount: 15, maxGainPerAction: 30 },
        { type: EffectType.ModifyResource, resourceId: "sword_intent", amount: 15, maxGainPerAction: 30 },
        { type: EffectType.ModifyResource, resourceId: "sword_intent", amount: 15, maxGainPerAction: 30 },
      ],
    })
    const battle = battleWith(capped)
    battle.unit("source").resources[0]!.current = 0
    battle.unit("source").resources[0]!.max = 100
    battle.submit("source", { type: CommandType.Skill, skillId: capped.id, targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()
    expect(battle.unit("source").resources[0]?.current).toBe(30)

    const lethal = battleWith(skill({ effects: [{ type: EffectType.PhysicalHit, coeff: 10 }] }))
    lethal.unit("target").attrs.hp = 30
    lethal.unit("target").attrs.maxHp = 200
    let hpDamage = -1
    lethal.hooks.on(HookName.OnBeHit, (context) => { hpDamage = context.hpDamage ?? -1 })
    lethal.submit("source", { type: CommandType.Skill, skillId: "resource-strike", targets: ["target"] })
    lethal.lockAndResolve()
    expect(hpDamage).toBe(30)
  })

  it("clamps resource changes and persists them in snapshots and events", () => {
    const battle = battleWith()
    battle.submit("source", { type: CommandType.Skill, skillId: "resource-strike", targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()

    expect(battle.unit("source").resources).toEqual([
      { id: "sword_intent", name: "剑意", current: 11, max: 11 },
    ])
    expect(battle.snapshot().units[0]?.resources).toEqual(battle.unit("source").resources)
    expect(battle.log()).toContainEqual({
      type: EventType.ResourceChanged,
      sourceId: "source",
      unitId: "source",
      resourceId: "sword_intent",
      before: 10,
      after: 11,
    })
  })

  it("uses resource thresholds and applies physical defense ignore before formulas", () => {
    const conditional = skill({
      effects: [
        {
          type: EffectType.PhysicalHit,
          coeff: 1,
          defenseIgnore: 0.5,
          when: { sourceResource: { id: "sword_intent", min: 10 } },
        },
      ],
    })
    const battle = battleWith(conditional)
    battle.submit("source", { type: CommandType.Skill, skillId: conditional.id, targets: ["target"] })
    battle.submit("target", { type: CommandType.Protect, target: "target" })
    battle.lockAndResolve()

    expect(battle.unit("target").attrs.hp).toBe(120)
  })

  it("rejects a skill whose resource requirement is not met", () => {
    const finisher = skill({
      id: "finisher",
      resourceRequirements: [{ resourceId: "sword_intent", min: 11 }],
      effects: [{ type: EffectType.PhysicalHit, coeff: 2 }],
    })
    const battle = battleWith(finisher)
    battle.unit("source").resources[0]!.current = 5
    battle.submit("source", { type: CommandType.Skill, skillId: finisher.id, targets: ["target"] })
    battle.submit("target", { type: CommandType.Defend })
    battle.lockAndResolve()

    expect(battle.log()).toContainEqual({
      type: EventType.ActionFailed,
      unitId: "source",
      reason: "resource-requirement:sword_intent",
    })
  })

  it("passes the defeating source and skill to fatal and death hooks", () => {
    const lethal = skill({
      effects: [
        { type: EffectType.PhysicalHit, coeff: 10 },
        { type: EffectType.ModifyResource, resourceId: "sword_intent", amount: 0, mode: "set" },
      ],
    })
    const battle = battleWith(lethal)
    const seen: Array<{ hook: string; source?: string; target?: string; skillId?: string }> = []
    battle.hooks.on(HookName.OnFatal, ({ source, target, skillId }) => {
      seen.push({ hook: HookName.OnFatal, source: source?.id, target: target?.id, skillId })
    })
    battle.hooks.on(HookName.OnDeath, ({ source, target, skillId }) => {
      seen.push({ hook: HookName.OnDeath, source: source?.id, target: target?.id, skillId })
    })
    battle.submit("source", { type: CommandType.Skill, skillId: lethal.id, targets: ["target"] })
    battle.lockAndResolve()

    expect(seen).toEqual([
      { hook: HookName.OnFatal, source: "source", target: "target", skillId: lethal.id },
      { hook: HookName.OnDeath, source: "source", target: "target", skillId: lethal.id },
    ])
    expect(battle.unit("source").resources[0]?.current).toBe(0)
  })
})
