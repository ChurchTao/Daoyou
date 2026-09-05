import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import type {
  CombatV6CapabilityContribution,
  ResolveCombatCapabilitiesV1Result,
} from "./types.ts"

function error(
  code: "CAPABILITY_POLICY_CONFLICT" | "CAPABILITY_RESOLUTION_CONFLICT",
  message: string,
): CombatV6ProjectionDiagnostic {
  return { severity: "error", code, message }
}

function stable(contributions: CombatV6CapabilityContribution[]): CombatV6CapabilityContribution[] {
  return [...contributions].sort((left, right) =>
    `${left.sourceType}:${left.sourceId}`.localeCompare(`${right.sourceType}:${right.sourceId}`),
  )
}

function sameResult(left: CombatV6CapabilityContribution, right: CombatV6CapabilityContribution): boolean {
  return [...left.passiveIds].sort().join("\0") === [...right.passiveIds].sort().join("\0")
}

export function resolveCombatCapabilitiesV1(
  contributions: CombatV6CapabilityContribution[],
): ResolveCombatCapabilitiesV1Result {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const selected: CombatV6CapabilityContribution[] = []
  const grouped = new Map<string, CombatV6CapabilityContribution[]>()

  for (const contribution of contributions) {
    const invalid =
      !contribution.capabilityKey.trim() ||
      !contribution.sourceId.trim() ||
      !["stack", "unique", "highest"].includes(contribution.stackPolicy) ||
      !Number.isFinite(contribution.priority) ||
      !Array.isArray(contribution.passiveIds) ||
      contribution.passiveIds.some((id) => !id.trim()) ||
      (contribution.stackPolicy === "highest" && !Number.isFinite(contribution.strength))
    if (invalid) {
      diagnostics.push(error("CAPABILITY_RESOLUTION_CONFLICT", `能力贡献无效：${contribution.sourceId || "unknown"}`))
      continue
    }
    const list = grouped.get(contribution.capabilityKey) ?? []
    list.push(contribution)
    grouped.set(contribution.capabilityKey, list)
  }

  for (const [key, raw] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    const entries = stable(raw)
    const policies = new Set(entries.map((entry) => entry.stackPolicy))
    if (policies.size !== 1) {
      diagnostics.push(error("CAPABILITY_POLICY_CONFLICT", `能力 ${key} 的叠加策略不一致`))
      continue
    }
    const policy = entries[0].stackPolicy
    if (policy === "stack") {
      selected.push(...entries)
      continue
    }
    const ranked = [...entries].sort((left, right) => {
      if (policy === "highest" && (right.strength ?? 0) !== (left.strength ?? 0)) {
        return (right.strength ?? 0) - (left.strength ?? 0)
      }
      return right.priority - left.priority
    })
    const winner = ranked[0]
    const tied = ranked.filter((entry) =>
      entry.priority === winner.priority &&
      (policy !== "highest" || entry.strength === winner.strength),
    )
    if (tied.some((entry) => !sameResult(entry, winner))) {
      diagnostics.push(error("CAPABILITY_RESOLUTION_CONFLICT", `能力 ${key} 无法唯一决出有效来源`))
      continue
    }
    selected.push(winner)
  }

  if (diagnostics.length) return { ok: false, diagnostics }
  return {
    ok: true,
    contributions: selected,
    passiveIds: [...new Set(selected.flatMap((entry) => entry.passiveIds))],
    diagnostics,
  }
}
