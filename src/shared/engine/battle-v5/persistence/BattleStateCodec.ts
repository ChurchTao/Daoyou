import { Ability } from '../abilities/Ability';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { Buff } from '../buffs/Buff';
import { DataDrivenBuff } from '../buffs/DataDrivenBuff';
import { BattleRoster } from '../core/BattleRoster';
import {
  exportBattleRuntimeState,
  getBattleRuntimeState,
  restoreBattleRuntimeState,
} from '../core/runtimeState';
import type { AttributeModifierConfig } from '../core/configs';
import { DelayedRuntimeBuff } from '../effects/DelayedEffect';
import { AbilityFactory } from '../factories/AbilityFactory';
import { BuffFactory } from '../factories/BuffFactory';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import { CombatAttributionV3 } from '../v3/origin';
import type {
  BattleBlueprintV1,
  BattleBuffBlueprintV1,
  BattleCheckpointV1,
  BattleSaveV1,
  BattleUnitBlueprintV1,
  SerializedBattleBuffV1,
} from './types';

export interface RestoredBattleV1 {
  blueprint: BattleBlueprintV1;
  checkpoint: BattleCheckpointV1;
  runtime: BattleRuntime;
  roster: BattleRoster;
}

export function createBattleBlueprint(
  battleId: string,
  roster: BattleRoster,
  revision = 1,
): BattleBlueprintV1 {
  const teams = [...roster.teams.values()].map((team) => ({
    id: team.id,
    units: team.unitIds.map((unitId) =>
      createUnitBlueprint(roster.getUnit(unitId)),
    ),
  }));
  if (!battleId || teams.length !== 2) {
    throw new Error('Battle blueprint requires an id and exactly two teams');
  }
  const blueprint: BattleBlueprintV1 = {
    version: 'battle_blueprint_v1',
    battleId,
    revision,
    teams: teams as BattleBlueprintV1['teams'],
  };
  validateBlueprint(blueprint);
  return cloneJson(blueprint);
}

export function instantiateBattleBlueprint(
  blueprint: BattleBlueprintV1,
  runtime = new BattleRuntime(),
  applyStartingBuffs = true,
): { runtime: BattleRuntime; roster: BattleRoster } {
  validateBlueprint(blueprint);
  const units = blueprint.teams.flatMap((team) =>
    team.units.map((unitBlueprint) =>
      instantiateUnit(team.id, unitBlueprint, runtime),
    ),
  );
  const roster = new BattleRoster(units);
  if (applyStartingBuffs) {
    for (const team of blueprint.teams) {
      for (const unitBlueprint of team.units) {
        const owner = roster.getUnit(unitBlueprint.id);
        for (const startingBuff of unitBlueprint.startingBuffs) {
          applyBuffBlueprint(owner, startingBuff, roster);
        }
      }
    }
  }
  return { runtime, roster };
}

export function captureBattleCheckpoint(input: {
  blueprint: BattleBlueprintV1;
  roster: BattleRoster;
  runtime: BattleRuntime;
  round: number;
  checkpointRevision: number;
}): BattleCheckpointV1 {
  validateBlueprint(input.blueprint);
  const expectedIds = new Set(
    input.blueprint.teams.flatMap((team) =>
      team.units.map((unit) => unit.id),
    ),
  );
  const actualIds = new Set(input.roster.units.keys());
  assertSameUnitIds(actualIds, expectedIds, 'checkpoint roster');

  const units: BattleCheckpointV1['units'] = {};
  for (const unit of input.roster.getAllUnits()) {
    const runtimeState = getBattleRuntimeState(unit);
    units[unit.id] = {
      unitId: unit.id,
      hp: unit.getCurrentHp(),
      mp: unit.getCurrentMp(),
      shield: unit.getCurrentShield(),
      cooldowns: Object.fromEntries(
        unit.abilities
          .getAllAbilities()
          .filter((ability): ability is ActiveSkill =>
            ability instanceof ActiveSkill,
          )
          .map((ability) => [ability.id, ability.currentCooldown]),
      ),
      combatResources: Object.fromEntries(
        unit.combatResources
          .snapshots()
          .map((resource) => [resource.id, resource.current]),
      ),
      tags: unit.tags.getTags(),
      buffs: unit.buffs
        .getAllBuffs()
        .map((buff) => serializeBuff(buff)),
      recentRemovedBuffs: runtimeState.removedBuffs.map((buff) =>
        serializeBuff(buff),
      ),
      runtimeState: exportBattleRuntimeState(unit),
    };
  }

  const checkpoint: BattleCheckpointV1 = {
    version: 'battle_checkpoint_v1',
    battleId: input.blueprint.battleId,
    blueprintRevision: input.blueprint.revision,
    checkpointRevision: input.checkpointRevision,
    round: input.round,
    phase: 'planning',
    runtime: input.runtime.exportCursor(),
    units,
  };
  validateCheckpoint(input.blueprint, checkpoint);
  return cloneJson(checkpoint);
}

export function restoreBattleSave(save: BattleSaveV1): RestoredBattleV1 {
  validateBattleSave(save);
  const runtime = new BattleRuntime();
  runtime.restoreCursor(save.checkpoint.runtime);
  const { roster } = instantiateBattleBlueprint(
    save.blueprint,
    runtime,
    false,
  );

  for (const checkpointUnit of Object.values(save.checkpoint.units)) {
    const unit = roster.getUnit(checkpointUnit.unitId);
    unit.initializeResources({
      hp: checkpointUnit.hp,
      mp: checkpointUnit.mp,
      shield: checkpointUnit.shield,
    });
    for (const [resourceId, value] of Object.entries(
      checkpointUnit.combatResources,
    )) {
      unit.combatResources.set(resourceId, value);
    }
    for (const [abilityId, cooldown] of Object.entries(
      checkpointUnit.cooldowns,
    )) {
      const ability = unit.abilities.getAbility(abilityId);
      if (!(ability instanceof ActiveSkill)) {
        throw new Error(`Checkpoint references unknown active ability: ${abilityId}`);
      }
      ability.resetCooldown();
      ability.modifyCooldown(cooldown);
    }
    for (const serializedBuff of checkpointUnit.buffs) {
      restoreBuff(unit, serializedBuff, roster);
    }
    unit.tags.clear();
    unit.tags.addTags(checkpointUnit.tags);
    restoreBattleRuntimeState(unit, checkpointUnit.runtimeState);
    const state = getBattleRuntimeState(unit);
    state.removedBuffs = checkpointUnit.recentRemovedBuffs.map((buff) =>
      deserializeBuff(buff),
    );
  }

  return {
    blueprint: cloneJson(save.blueprint),
    checkpoint: cloneJson(save.checkpoint),
    runtime,
    roster,
  };
}

export function encodeBattleSave(save: BattleSaveV1): string {
  validateBattleSave(save);
  return JSON.stringify(save);
}

export function decodeBattleSave(value: string): BattleSaveV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Battle save is not valid JSON');
  }
  validateBattleSave(parsed as BattleSaveV1);
  return parsed as BattleSaveV1;
}

export function validateBattleSave(save: BattleSaveV1): void {
  if (!save || save.version !== 'battle_save_v1') {
    throw new Error('Battle save has an invalid version');
  }
  validateBlueprint(save.blueprint);
  validateCheckpoint(save.blueprint, save.checkpoint);
}

function createUnitBlueprint(unit: Unit): BattleUnitBlueprintV1 {
  const abilityConfigs = unit.abilities.getAllAbilities().map((ability) => {
    const config = ability.getSerializableConfig();
    if (!config) {
      throw new Error(`Ability ${ability.id} is not serializable`);
    }
    return config;
  });
  const modifiers: AttributeModifierConfig[] = unit.attributes
    .getModifiers()
    .filter(
      (modifier) =>
        !(modifier.source instanceof Ability) &&
        !(modifier.source instanceof Buff),
    )
    .map(({ attrType, type, value }) => ({ attrType, type, value }));
  const startingBuffs = unit.buffs.getAllBuffs().map((buff) => {
    if (!(buff instanceof DataDrivenBuff)) {
      throw new Error(`Starting buff ${buff.id} is not blueprint-serializable`);
    }
    return {
      config: buff.getConfig(),
      sourceUnitId: buff.getSource()?.id,
      layers: buff.getLayer(),
      duration: buff.getDuration(),
    };
  });
  const meta = unit.getRealmMeta();
  const defaultAttack = unit.abilities.getDefaultAttackForSnapshot();
  const defaultAttackConfig = defaultAttack?.getSerializableConfig();
  if (defaultAttack && !defaultAttackConfig) {
    throw new Error(`Default attack ${defaultAttack.id} is not serializable`);
  }
  return {
    id: unit.id,
    name: unit.name,
    slot: unit.slot,
    baseAttributes: unit.attributes.getAllBaseValues(),
    modifiers,
    abilityConfigs,
    ...(defaultAttackConfig ? { defaultAttackConfig } : {}),
    combatResources: unit.combatResources.exportDefinitions(),
    tags: unit.tags.getTags(),
    spiritualRoots: unit.getSpiritualRoots(),
    realm: meta.realm,
    realmStage: meta.realmStage,
    realmRank: meta.realmRank,
    startingBuffs,
  };
}

function instantiateUnit(
  teamId: string,
  blueprint: BattleUnitBlueprintV1,
  runtime: BattleRuntime,
): Unit {
  const unit = new Unit(blueprint.id, blueprint.name, blueprint.baseAttributes, {
    runtime,
    teamId,
    slot: blueprint.slot,
  });
  unit.setSpiritualRoots(blueprint.spiritualRoots);
  unit.setRealmMeta({
    realm: blueprint.realm,
    realmStage: blueprint.realmStage,
    realmRank: blueprint.realmRank,
  });
  blueprint.modifiers.forEach((modifier, index) => {
    unit.attributes.addModifier({
      id: `blueprint:${blueprint.id}:${index}`,
      ...modifier,
      source: { sourceType: 'battle_blueprint' },
    });
  });
  for (const resource of blueprint.combatResources) {
    unit.combatResources.define(resource);
  }
  for (const config of blueprint.abilityConfigs) {
    unit.abilities.addAbility(AbilityFactory.create(config));
  }
  if (blueprint.defaultAttackConfig) {
    unit.abilities.setDefaultAttack(AbilityFactory.create(blueprint.defaultAttackConfig));
  }
  unit.tags.clear();
  unit.tags.addTags(blueprint.tags);
  unit.updateDerivedStats();
  unit.initializeCurrentResourcesToMax();
  return unit;
}

function applyBuffBlueprint(
  owner: Unit,
  blueprint: BattleBuffBlueprintV1,
  roster: BattleRoster,
): void {
  const buff = BuffFactory.create(blueprint.config);
  if (blueprint.layers) buff.setLayer(blueprint.layers);
  owner.buffs.initializeBuff(
    buff,
    blueprint.sourceUnitId
      ? roster.getUnit(blueprint.sourceUnitId)
      : owner,
  );
  if (blueprint.duration !== undefined) {
    buff.restoreDuration(blueprint.duration, blueprint.config.duration);
  }
}

function serializeBuff(buff: Buff): SerializedBattleBuffV1 {
  const attribution = buff.getCombatAttributionV3();
  const common = {
    id: buff.id,
    sourceUnitId: buff.getSource()?.id,
    attributionOwnerId: attribution?.owner.id,
    origin: attribution?.origin,
    layer: buff.getLayer(),
    duration: buff.getDuration(),
    maxDuration: buff.getMaxDuration(),
  };
  if (buff instanceof DataDrivenBuff) {
    return { ...common, kind: 'data', config: buff.getConfig() };
  }
  if (buff instanceof DelayedRuntimeBuff) {
    return {
      ...common,
      kind: 'delayed',
      params: buff.getParams(),
      ...buff.getRuntimeState(),
    };
  }
  throw new Error(`Buff ${buff.id} is not checkpoint-serializable`);
}

function deserializeBuff(serialized: SerializedBattleBuffV1): Buff {
  const buff = serialized.kind === 'data'
    ? BuffFactory.create(serialized.config)
    : new DelayedRuntimeBuff(serialized.params);
  buff.setLayer(serialized.layer);
  buff.restoreDuration(serialized.duration, serialized.maxDuration);
  if (buff instanceof DelayedRuntimeBuff && serialized.kind === 'delayed') {
    buff.restoreRuntimeState(serialized.remainingTurns, serialized.triggerCount);
  }
  return buff;
}

function restoreBuff(
  owner: Unit,
  serialized: SerializedBattleBuffV1,
  roster: BattleRoster,
): void {
  const buff = deserializeBuff(serialized);
  const source = serialized.sourceUnitId
    ? roster.getUnit(serialized.sourceUnitId)
    : undefined;
  if (!serialized.attributionOwnerId || !serialized.origin) {
    throw new Error(`Active buff ${serialized.id} has no attribution`);
  }
  const attributionOwner = roster.getUnit(serialized.attributionOwnerId);
  owner.buffs.initializeBuff(buff, source, {
    attribution: CombatAttributionV3.rebind(
      attributionOwner,
      serialized.origin,
    ),
  });
}

function validateBlueprint(blueprint: BattleBlueprintV1): void {
  if (
    !blueprint ||
    blueprint.version !== 'battle_blueprint_v1' ||
    !blueprint.battleId ||
    !Number.isSafeInteger(blueprint.revision) ||
    blueprint.revision < 1 ||
    blueprint.teams.length !== 2
  ) {
    throw new Error('Invalid battle blueprint');
  }
  const teamIds = new Set<string>();
  const unitIds = new Set<string>();
  for (const team of blueprint.teams) {
    if (!team.id || teamIds.has(team.id) || team.units.length < 1 || team.units.length > 4) {
      throw new Error(`Invalid battle blueprint team: ${team.id}`);
    }
    teamIds.add(team.id);
    const slots = new Set<number>();
    for (const unit of team.units) {
      if (!unit.id || unitIds.has(unit.id) || slots.has(unit.slot)) {
        throw new Error(`Invalid battle blueprint unit: ${unit.id}`);
      }
      unitIds.add(unit.id);
      slots.add(unit.slot);
    }
  }
}

function validateCheckpoint(
  blueprint: BattleBlueprintV1,
  checkpoint: BattleCheckpointV1,
): void {
  if (
    !checkpoint ||
    checkpoint.version !== 'battle_checkpoint_v1' ||
    checkpoint.phase !== 'planning' ||
    checkpoint.battleId !== blueprint.battleId ||
    checkpoint.blueprintRevision !== blueprint.revision ||
    !Number.isSafeInteger(checkpoint.checkpointRevision) ||
    checkpoint.checkpointRevision < 0 ||
    !Number.isSafeInteger(checkpoint.round) ||
    checkpoint.round < 0
  ) {
    throw new Error('Invalid battle checkpoint');
  }
  const expectedIds = new Set(
    blueprint.teams.flatMap((team) => team.units.map((unit) => unit.id)),
  );
  assertSameUnitIds(
    new Set(Object.keys(checkpoint.units)),
    expectedIds,
    'checkpoint',
  );
  for (const [unitId, unit] of Object.entries(checkpoint.units)) {
    if (
      unit.unitId !== unitId ||
      !Number.isFinite(unit.hp) ||
      !Number.isFinite(unit.mp) ||
      !Number.isFinite(unit.shield)
    ) {
      throw new Error(`Invalid checkpoint unit: ${unitId}`);
    }
  }
}

function assertSameUnitIds(
  actual: ReadonlySet<string>,
  expected: ReadonlySet<string>,
  label: string,
): void {
  if (
    actual.size !== expected.size ||
    [...actual].some((unitId) => !expected.has(unitId))
  ) {
    throw new Error(`${label} unit ids do not match the blueprint`);
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
