import type {
  Attrs,
  BattleEvent,
  BattleState,
  CombatV6CommandOptions,
  CombatV6VersionStamp,
  Command,
  CreateBattleInput,
  LineupUnit,
  SkillDef,
  StatusDef,
  UnitKind,
} from "../core/index.ts"
import type { ProjectCultivatorMultiSectToCombatV6Input } from "../projection/index.ts"

export type CombatV6TrainingTierV1 = 60 | 120 | 180

export type PveCommandStrategyV1 =
  | { type: "defend" }
  | { type: "attack" }
  | { type: "skill-rotation"; skillIds: string[] }

export interface PveCombatantDefV1 {
  id: string
  name: string
  level: CombatV6TrainingTierV1
  /** 决定0气血时倒地还是死亡；训练友方使用player语义但不读取人物构筑。 */
  kind: UnitKind
  attrs: Attrs
  skillIds: string[]
  passiveIds: string[]
  skillLevels: Record<string, number>
  tags: string[]
  strategy: PveCommandStrategyV1
}

export interface CombatV6EncounterDefV1 {
  id: string
  name: string
  playerSlot: number
  participants: Array<{ combatantId: string; side: 0 | 1; slot: number }>
}

export type CombatV6TrainingContentV1 = {
  combatants: readonly PveCombatantDefV1[]
  encounters: readonly CombatV6EncounterDefV1[]
  skills: readonly SkillDef[]
  statusDefs: readonly StatusDef[]
}

export type CombatV6EncounterDiagnosticCode =
  | "UNKNOWN_TRAINING_ENCOUNTER"
  | "UNKNOWN_TRAINING_TIER"
  | "UNKNOWN_PVE_COMBATANT"
  | "INVALID_PVE_COMBATANT"
  | "INVALID_PVE_ATTRIBUTE"
  | "INVALID_PVE_STRATEGY"
  | "UNKNOWN_PVE_SKILL"
  | "UNKNOWN_PVE_PASSIVE"
  | "INVALID_ENCOUNTER_LINEUP"
  | "ENCOUNTER_CONTENT_ID_CONFLICT"
  | "PLAYER_PROJECTION_FAILED"

export type CombatV6EncounterDiagnostic = {
  severity: "error" | "warning"
  code: CombatV6EncounterDiagnosticCode
  message: string
  path?: string
}

export type CombatV6TrainingPlayerInput = Omit<
  ProjectCultivatorMultiSectToCombatV6Input,
  "side" | "slot" | "resourcePolicy"
>

export type CompileCombatV6TrainingEncounterV1Input = {
  encounterId: string
  tier: CombatV6TrainingTierV1
  seed: number
  player: CombatV6TrainingPlayerInput
}

export type CompiledCombatV6TrainingEncounterV1 = {
  encounterId: string
  tier: CombatV6TrainingTierV1
  seed: number
  playerId: string
  npcStrategies: Record<string, PveCommandStrategyV1>
  battleInput: CreateBattleInput
  sourceProjectionVersions: CombatV6VersionStamp
  sourcePlayerInput: CombatV6TrainingPlayerInput
}

export type CompileCombatV6TrainingEncounterV1Result =
  | { ok: true; compiled: CompiledCombatV6TrainingEncounterV1; diagnostics: CombatV6EncounterDiagnostic[]; versions: CombatV6VersionStamp }
  | { ok: false; diagnostics: CombatV6EncounterDiagnostic[]; versions: CombatV6VersionStamp }

export type TrainingEncounterOutcome = "victory" | "defeat" | "draw" | "aborted"

export interface CombatV6EncounterTraceV1 {
  schemaVersion: 1
  hostVersion: "combat_v6_encounter_host_v1"
  encounterId: string
  tier: CombatV6TrainingTierV1
  seed: number
  combatVersions: CombatV6VersionStamp
  sourceProjectionVersions: CombatV6VersionStamp
  initialUnits: LineupUnit[]
  skills: SkillDef[]
  statusDefs: StatusDef[]
  rounds: Array<{ round: number; commands: Array<{ unitId: string; command: Command }> }>
  events: BattleEvent[]
  finalState?: BattleState
  outcome?: TrainingEncounterOutcome
}

/** Redis运行时快照；仅保证当前combat-v6版本内恢复，不是长期录像协议。 */
export interface CombatV6TrainingRuntimeSnapshotV1 {
  schemaVersion: 1
  hostVersion: "combat_v6_training_runtime_v1"
  input: CompileCombatV6TrainingEncounterV1Input
  state: BattleState
  rounds: CombatV6EncounterTraceV1["rounds"]
  events: BattleEvent[]
}

export interface CombatV6TrainingHostV1 {
  readonly playerId: string
  readonly finished: boolean
  readonly state: BattleState
  queryCommands(unitId?: string): CombatV6CommandOptions
  submit(unitId: string, command: Command): void
  resolveRound(afterAction?: (state: BattleState, eventSeq: number) => void): BattleEvent[]
  snapshot(): BattleState
  trace(): CombatV6EncounterTraceV1
  runtimeSnapshot(): CombatV6TrainingRuntimeSnapshotV1
}
