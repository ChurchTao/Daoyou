import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { projectCharacterToCombatV6, type CharacterCombatInput } from "./index.ts"
import baseline from "./fixtures/character-build.json" with { type: 'json' }

describe("current character build", () => {
  it("preserves approved panels, content, resources and diagnostics", () => {
    const actual = baseline.inputs.map((input) => createHash("sha256")
      .update(JSON.stringify(projectCharacterToCombatV6(input as unknown as CharacterCombatInput)))
      .digest("hex"))
    expect(actual).toEqual(baseline.expected)
  })
})
