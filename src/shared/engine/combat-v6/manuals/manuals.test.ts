import { describe, expect, it } from "vitest"
import type { RealmType } from "@shared/types/constants"
import {
  CHARACTER_MANUAL_ID,
  CHARACTER_MANUALS_V1,
  compileCharacterManualsV1,
  forgetManualV1,
  getManualSlotCount,
  learnManualV1,
  replaceManualV1,
  resolveCombatCapabilitiesV1,
  validateManualStateV1,
  type CharacterManualDefV1,
  type CombatV6CapabilityContribution,
  type CultivatorManualStateV1,
} from "./index.ts"

function empty(revision = 0): CultivatorManualStateV1 {
  return { version: 1, revision, build: { slots: [] } }
}

describe("combat-v6 Phase 5A 功法状态", () => {
  it("按大境界派生2～6个道印位", () => {
    const realms: RealmType[] = ["炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫"]
    expect(realms.map(getManualSlotCount)).toEqual([2, 3, 4, 5, 6, 6, 6, 6, 6])
  })

  it("显式参悟、真解原位升级和散功均不可变且revision逐次增加", () => {
    const original = empty(3)
    const learned = learnManualV1({
      state: original,
      realm: "炼气",
      slot: 2,
      manualId: CHARACTER_MANUAL_ID.DuanyueBase,
      expectedRevision: 3,
    })
    expect(learned.ok).toBe(true)
    expect(original).toEqual(empty(3))
    if (!learned.ok) return
    expect(learned.state).toMatchObject({ revision: 4, build: { slots: [{ slot: 2, manualId: CHARACTER_MANUAL_ID.DuanyueBase }] } })

    const upgraded = replaceManualV1({
      state: learned.state,
      realm: "炼气",
      slot: 2,
      expectedManualId: CHARACTER_MANUAL_ID.DuanyueBase,
      manualId: CHARACTER_MANUAL_ID.DuanyueTrue,
      expectedRevision: 4,
    })
    expect(upgraded.ok).toBe(true)
    if (!upgraded.ok) return
    expect(upgraded.state.revision).toBe(5)
    expect(upgraded.state.build.slots[0].manualId).toBe(CHARACTER_MANUAL_ID.DuanyueTrue)

    const forgotten = forgetManualV1({
      state: upgraded.state,
      realm: "炼气",
      slot: 2,
      expectedManualId: CHARACTER_MANUAL_ID.DuanyueTrue,
      expectedRevision: 5,
    })
    expect(forgotten).toMatchObject({ ok: true, state: { revision: 6, build: { slots: [] } } })
  })

  it("拒绝锁定槽、占用槽、过期revision、旧内容不匹配和真解降级", () => {
    const state: CultivatorManualStateV1 = {
      version: 1,
      revision: 2,
      build: { slots: [{ slot: 1, manualId: CHARACTER_MANUAL_ID.DuanyueTrue }] },
    }
    expect(learnManualV1({ state, realm: "炼气", slot: 3, manualId: CHARACTER_MANUAL_ID.NingguangBase, expectedRevision: 2 })).toMatchObject({ ok: false, diagnostics: [{ code: "MANUAL_SLOT_LOCKED" }] })
    expect(learnManualV1({ state, realm: "炼气", slot: 1, manualId: CHARACTER_MANUAL_ID.NingguangBase, expectedRevision: 2 })).toMatchObject({ ok: false, diagnostics: [{ code: "MANUAL_SLOT_OCCUPIED" }] })
    expect(learnManualV1({ state, realm: "炼气", slot: 2, manualId: CHARACTER_MANUAL_ID.NingguangBase, expectedRevision: 1 })).toMatchObject({ ok: false, diagnostics: [{ code: "INVALID_MANUAL_REVISION" }] })
    expect(forgetManualV1({ state, realm: "炼气", slot: 1, expectedManualId: "stale", expectedRevision: 2 })).toMatchObject({ ok: false, diagnostics: [{ code: "MANUAL_EXPECTED_MISMATCH" }] })
    expect(replaceManualV1({ state, realm: "炼气", slot: 1, expectedManualId: CHARACTER_MANUAL_ID.DuanyueTrue, manualId: CHARACTER_MANUAL_ID.DuanyueBase, expectedRevision: 2 })).toMatchObject({ ok: false, diagnostics: [{ code: "MANUAL_RANK_DOWNGRADE" }] })
    expect(state).toEqual({ version: 1, revision: 2, build: { slots: [{ slot: 1, manualId: CHARACTER_MANUAL_ID.DuanyueTrue }] } })
  })

  it("满槽时允许显式改修一个无冲突功法", () => {
    const state: CultivatorManualStateV1 = {
      version: 1,
      revision: 4,
      build: { slots: [
        { slot: 1, manualId: CHARACTER_MANUAL_ID.DuanyueBase },
        { slot: 2, manualId: CHARACTER_MANUAL_ID.PojunBase },
      ] },
    }
    const result = replaceManualV1({
      state,
      realm: "炼气",
      slot: 2,
      expectedManualId: CHARACTER_MANUAL_ID.PojunBase,
      manualId: CHARACTER_MANUAL_ID.NingguangBase,
      expectedRevision: 4,
    })
    expect(result).toMatchObject({
      ok: true,
      state: { revision: 5, build: { slots: [{ slot: 1 }, { slot: 2, manualId: CHARACTER_MANUAL_ID.NingguangBase }] } },
    })
    expect(state.build.slots[1].manualId).toBe(CHARACTER_MANUAL_ID.PojunBase)
  })

  it("同谱系不可共存，冲突组要求先散功", () => {
    const conflicted = CHARACTER_MANUALS_V1.map((definition) =>
      [CHARACTER_MANUAL_ID.DuanyueBase, CHARACTER_MANUAL_ID.NingguangBase].includes(definition.id)
        ? { ...definition, conflictGroups: ["stance.focus"] }
        : definition,
    )
    const state: CultivatorManualStateV1 = {
      version: 1,
      revision: 1,
      build: { slots: [
        { slot: 1, manualId: CHARACTER_MANUAL_ID.DuanyueBase },
        { slot: 2, manualId: CHARACTER_MANUAL_ID.PojunBase },
      ] },
    }
    expect(learnManualV1({ state, realm: "筑基", slot: 3, manualId: CHARACTER_MANUAL_ID.DuanyueTrue, expectedRevision: 1 })).toMatchObject({ ok: false, diagnostics: [{ code: "MANUAL_LINEAGE_CONFLICT" }] })
    expect(replaceManualV1({ state, realm: "筑基", slot: 2, expectedManualId: CHARACTER_MANUAL_ID.PojunBase, manualId: CHARACTER_MANUAL_ID.NingguangBase, expectedRevision: 1 }, conflicted)).toMatchObject({ ok: false, diagnostics: [{ code: "MANUAL_CONFLICT_REQUIRES_FORGET" }] })
    expect(learnManualV1({ state, realm: "筑基", slot: 3, manualId: CHARACTER_MANUAL_ID.NingguangBase, expectedRevision: 1 }, conflicted)).toMatchObject({ ok: false, diagnostics: [{ code: "MANUAL_CONFLICT_REQUIRES_FORGET" }] })
  })

  it("校验20个确定性定义并把被动技能等级固定为0", () => {
    expect(CHARACTER_MANUALS_V1).toHaveLength(20)
    expect(new Set(CHARACTER_MANUALS_V1.map((definition) => definition.lineageId)).size).toBe(10)
    const state: CultivatorManualStateV1 = {
      version: 1,
      revision: 0,
      build: {
        slots: [
          { slot: 1, manualId: CHARACTER_MANUAL_ID.DuanyueBase },
          { slot: 2, manualId: CHARACTER_MANUAL_ID.DinghunTrue },
        ],
      },
    }
    const result = compileCharacterManualsV1({ state, realm: "炼气" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.values(result.projection.skillLevels)).toEqual([0])
    expect(result.projection.panel).toEqual([{ attr: "sealResist", mode: "add", value: 20 }])
    expect(validateManualStateV1(state, "炼气")).toEqual([])
  })

  it("锁定十个谱系的本篇与真解强度", () => {
    const expected = [
      ["Duanyue", 0.05, 0.1], ["Ningguang", 0.05, 0.1],
      ["Pojun", 1.05, 1.1], ["Fenling", 1.05, 1.1],
      ["Yinxue", 0.1, 0.15], ["Huyuan", 0.08, 0.15],
      ["Huisheng", 0.2, 0.3], ["Mingsi", 0.02, 0.04],
      ["Shengxi", 0.01, 0.02],
    ] as const
    for (const [key, baseStrength, trueStrength] of expected) {
      const base = CHARACTER_MANUALS_V1.find((item) => item.id === CHARACTER_MANUAL_ID[`${key}Base`])
      const advanced = CHARACTER_MANUALS_V1.find((item) => item.id === CHARACTER_MANUAL_ID[`${key}True`])
      expect([base?.capability?.strength, advanced?.capability?.strength]).toEqual([baseStrength, trueStrength])
    }
    const dinghun = CHARACTER_MANUALS_V1
      .filter((item) => item.lineageId.endsWith("dinghun"))
      .map((item) => item.panel?.[0]?.value)
    expect(dinghun).toEqual([10, 20])
  })
})

describe("combat-v6 Phase 5A 能力解析", () => {
  const contribution = (
    sourceId: string,
    stackPolicy: CombatV6CapabilityContribution["stackPolicy"],
    options: Partial<CombatV6CapabilityContribution> = {},
  ): CombatV6CapabilityContribution => ({
    capabilityKey: "test.capability",
    sourceType: "manual",
    sourceId,
    stackPolicy,
    priority: 1,
    strength: 1,
    passiveIds: [`passive.${sourceId}`],
    ...options,
  })

  it("支持stack、unique与highest的稳定选择", () => {
    expect(resolveCombatCapabilitiesV1([contribution("b", "stack"), contribution("a", "stack")])).toMatchObject({
      ok: true,
      passiveIds: ["passive.a", "passive.b"],
    })
    expect(resolveCombatCapabilitiesV1([
      contribution("low", "unique"),
      contribution("high", "unique", { priority: 2 }),
    ])).toMatchObject({ ok: true, passiveIds: ["passive.high"] })
    expect(resolveCombatCapabilitiesV1([
      contribution("priority", "highest", { priority: 9, strength: 1 }),
      contribution("strength", "highest", { priority: 1, strength: 2 }),
    ])).toMatchObject({ ok: true, passiveIds: ["passive.strength"] })
  })

  it("策略冲突和无法决胜的并列阻止解析", () => {
    expect(resolveCombatCapabilitiesV1([contribution("a", "stack"), contribution("b", "unique")])).toMatchObject({ ok: false, diagnostics: [{ code: "CAPABILITY_POLICY_CONFLICT" }] })
    expect(resolveCombatCapabilitiesV1([contribution("a", "unique"), contribution("b", "unique")])).toMatchObject({ ok: false, diagnostics: [{ code: "CAPABILITY_RESOLUTION_CONFLICT" }] })
  })

  it("自定义内容错误会阻止编译", () => {
    const invalid: CharacterManualDefV1[] = [{ ...CHARACTER_MANUALS_V1[0], id: "" }]
    const result = compileCharacterManualsV1({ state: empty(), realm: "炼气" }, invalid)
    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.diagnostics.map((item) => item.code)).toContain("MANUAL_CONTENT_INVALID")
  })
})
