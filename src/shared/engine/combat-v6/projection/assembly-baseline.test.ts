import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import * as projections from "./index.ts"
import baseline from "./fixtures/before-a1.json"

// Retains A1 inputs; panel-dependent hashes follow the approved six-attribute formulas.
describe("A1 assembly baseline with current character panel", () => {
  for (const [name, expected] of Object.entries(baseline.expected)) {
    it(name, () => {
      const project = projections[name as keyof typeof baseline.expected]
      const actual = baseline.inputs.map((input) => createHash("sha256")
        .update(JSON.stringify(project(input as unknown as Parameters<typeof project>[0])))
        .digest("hex"))
      expect(actual).toEqual(expected)
    })
  }
  it("current entry retains the current phase output", () => {
    for (const input of baseline.inputs) {
      expect(projections.projectCharacterToCombatV6(input as unknown as projections.CharacterCombatInput))
        .toEqual(projections.projectCultivatorMultiSectV5ToCombatV6(input as unknown as projections.CharacterCombatInput))
    }
  })
})
