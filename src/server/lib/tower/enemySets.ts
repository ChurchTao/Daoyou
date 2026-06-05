import { EnemyGenerator } from '@shared/engine/enemyGenerator';
import {
  buildTowerEnemyVariantSeed,
  getNextTowerSeasonMeta,
  getTowerSeasonMeta,
  pickTowerRace,
  resolveTowerDifficulty,
  resolveTowerFloorKind,
  resolveTowerRealmStage,
  TOWER_ELIGIBLE_REALMS,
  TOWER_MAX_FLOOR,
  type TowerEncounter,
  type TowerPreparedEnemy,
  type TowerPreparedEnemySet,
  type TowerPreparedEnemySetStatus,
  type TowerSeasonMeta,
} from '@shared/lib/tower';
import type { RealmType } from '@shared/types/constants';
import { ServerEnemyCopyProvider } from '@server/lib/services/ServerEnemyCopyProvider';
import {
  findLatestReadyTowerEnemySet,
  findTowerEnemySet,
  listTowerEnemySetsBySeason,
  upsertFailedTowerEnemySet,
  upsertReadyTowerEnemySet,
  type TowerEnemySetRecord,
} from '@server/lib/repositories/towerEnemySetRepository';

export const TOWER_ENEMY_SET_SCHEMA_VERSION = 1;

export type TowerEnemySetEnsureResult = {
  seasonKey: string;
  realm: RealmType;
  generated: boolean;
  skipped: boolean;
  enemyCount: number;
  source: 'existing' | 'generated';
};

export type TowerEnemySetRefreshResult = {
  seasonKey: string;
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
  logs: string[];
};

export type TowerEnemySetAdminEnemySummary = {
  floor: number;
  kind: TowerEncounter['kind'];
  difficulty: number;
  race: TowerEncounter['race'];
  realmStage: TowerEncounter['realmStage'];
  name: string;
  title: string | null;
  source: TowerPreparedEnemy['generationMeta']['source'];
  generatedAt: string;
};

export type TowerEnemySetAdminRealmSummary = {
  seasonKey: string;
  realm: RealmType;
  status: TowerPreparedEnemySetStatus | 'missing' | 'incomplete';
  schemaVersion: number | null;
  enemyCount: number;
  generatedAt: string | null;
  updatedAt: string | null;
  errorMessage: string | null;
  sourceCounts: Record<TowerPreparedEnemy['generationMeta']['source'], number>;
  enemies: TowerEnemySetAdminEnemySummary[];
};

export type TowerEnemySetAdminSnapshot = {
  seasonKey: string;
  realms: TowerEnemySetAdminRealmSummary[];
};

type TowerEnemySetServiceDeps = {
  generator?: EnemyGenerator;
  fallbackGenerator?: EnemyGenerator;
};

const defaultGenerator = new EnemyGenerator({
  copyProvider: new ServerEnemyCopyProvider({
    enabled: process.env.NODE_ENV !== 'test',
  }),
});
const defaultFallbackGenerator = new EnemyGenerator();

function buildTowerEncounter(args: {
  seasonKey: string;
  realm: RealmType;
  floor: number;
}): TowerEncounter {
  const kind = resolveTowerFloorKind(args.floor);
  return {
    floor: args.floor,
    kind,
    difficulty: resolveTowerDifficulty(args.floor),
    race: pickTowerRace(`${args.seasonKey}:${args.realm}`, args.floor),
    realm: args.realm,
    realmStage: resolveTowerRealmStage(args.floor),
    isBoss: kind === 'boss',
  };
}

function isCompleteEnemySet(
  set: Pick<TowerPreparedEnemySet, 'enemies'> | undefined,
): set is Pick<TowerPreparedEnemySet, 'enemies'> {
  if (!set || set.enemies.length !== TOWER_MAX_FLOOR) {
    return false;
  }

  const floors = new Set(set.enemies.map((enemy) => enemy.floor));
  for (let floor = 1; floor <= TOWER_MAX_FLOOR; floor += 1) {
    if (!floors.has(floor)) {
      return false;
    }
  }

  return true;
}

function toPreparedEnemySet(
  record: TowerEnemySetRecord | undefined,
): TowerPreparedEnemySet | undefined {
  if (!record || record.status !== 'ready') {
    return undefined;
  }

  const set: TowerPreparedEnemySet = {
    seasonKey: record.seasonKey,
    realm: record.realm as RealmType,
    generatedAt: record.generatedAt.toISOString(),
    enemies: record.enemies,
  };

  return isCompleteEnemySet(set) ? set : undefined;
}

function clonePreparedEnemy(enemy: TowerPreparedEnemy): TowerPreparedEnemy {
  return structuredClone(enemy);
}

function isLlmEnriched(draft: ReturnType<EnemyGenerator['buildDraft']>): boolean {
  return Object.values(draft.missingNarrative).every((missing) => !missing);
}

export class TowerEnemySetService {
  private readonly generator: EnemyGenerator;
  private readonly fallbackGenerator: EnemyGenerator;

  constructor(deps: TowerEnemySetServiceDeps = {}) {
    this.generator = deps.generator ?? defaultGenerator;
    this.fallbackGenerator = deps.fallbackGenerator ?? defaultFallbackGenerator;
  }

  async ensureTowerEnemySet(
    season: TowerSeasonMeta,
    realm: RealmType,
    options: { force?: boolean } = {},
  ): Promise<TowerEnemySetEnsureResult> {
    const existing = options.force
      ? undefined
      : toPreparedEnemySet(
          await findTowerEnemySet({
            seasonKey: season.seasonKey,
            realm,
            status: 'ready',
          }),
        );
    if (existing) {
      return {
        seasonKey: season.seasonKey,
        realm,
        generated: false,
        skipped: true,
        enemyCount: existing.enemies.length,
        source: 'existing',
      };
    }

    try {
      const generatedAt = new Date();
      const enemies: TowerPreparedEnemy[] = [];
      for (let floor = 1; floor <= TOWER_MAX_FLOOR; floor += 1) {
        enemies.push(
          await this.generatePreparedEnemy({
            seasonKey: season.seasonKey,
            realm,
            floor,
            generatedAt,
          }),
        );
      }

      await upsertReadyTowerEnemySet({
        seasonKey: season.seasonKey,
        realm,
        enemies,
        generatedAt,
        schemaVersion: TOWER_ENEMY_SET_SCHEMA_VERSION,
      });

      return {
        seasonKey: season.seasonKey,
        realm,
        generated: true,
        skipped: false,
        enemyCount: enemies.length,
        source: 'generated',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'tower enemy generation failed';
      await upsertFailedTowerEnemySet({
        seasonKey: season.seasonKey,
        realm,
        errorMessage: message,
      });
      throw error;
    }
  }

  async ensureTowerEnemySetsForSeason(
    season: TowerSeasonMeta,
    options: { force?: boolean } = {},
  ): Promise<TowerEnemySetRefreshResult> {
    const logs: string[] = [];
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const realm of TOWER_ELIGIBLE_REALMS) {
      try {
        const result = await this.ensureTowerEnemySet(season, realm, options);
        if (result.generated) generated += 1;
        if (result.skipped) skipped += 1;
        logs.push(`${realm}: ${result.source} ${result.enemyCount}`);
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        logs.push(`${realm}: failed ${message}`);
      }
    }

    return {
      seasonKey: season.seasonKey,
      processed: TOWER_ELIGIBLE_REALMS.length,
      generated,
      skipped,
      failed,
      logs,
    };
  }

  async refreshCurrentAndNextIfNeeded(now: Date = new Date()) {
    const current = getTowerSeasonMeta(now);
    const results = [await this.ensureTowerEnemySetsForSeason(current)];
    const nextResetAtMs = Date.parse(current.nextResetAt);
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (nextResetAtMs - now.getTime() <= oneDayMs) {
      results.push(
        await this.ensureTowerEnemySetsForSeason(getNextTowerSeasonMeta(now)),
      );
    }

    return results;
  }

  async loadTowerEnemyForBattle(args: {
    seasonKey: string;
    realm: RealmType;
    floor: number;
  }): Promise<TowerPreparedEnemy> {
    const current = toPreparedEnemySet(
      await findTowerEnemySet({
        seasonKey: args.seasonKey,
        realm: args.realm,
        status: 'ready',
      }),
    );
    const fromCurrent = current?.enemies.find((enemy) => enemy.floor === args.floor);
    if (fromCurrent) {
      return clonePreparedEnemy(fromCurrent);
    }

    const latest = toPreparedEnemySet(
      await findLatestReadyTowerEnemySet({ realm: args.realm }),
    );
    const fromLatest = latest?.enemies.find((enemy) => enemy.floor === args.floor);
    if (fromLatest) {
      return clonePreparedEnemy(fromLatest);
    }

    return this.generateFallbackPreparedEnemy(args);
  }

  async getAdminSnapshot(
    seasonKey: string,
  ): Promise<TowerEnemySetAdminSnapshot> {
    const rows = await listTowerEnemySetsBySeason({ seasonKey });
    const rowByRealm = new Map(
      rows.map((row) => [row.realm as RealmType, row] as const),
    );

    return {
      seasonKey,
      realms: TOWER_ELIGIBLE_REALMS.map((realm) =>
        this.buildAdminRealmSummary(seasonKey, realm, rowByRealm.get(realm)),
      ),
    };
  }

  private buildAdminRealmSummary(
    seasonKey: string,
    realm: RealmType,
    row: TowerEnemySetRecord | undefined,
  ): TowerEnemySetAdminRealmSummary {
    if (!row) {
      return {
        seasonKey,
        realm,
        status: 'missing',
        schemaVersion: null,
        enemyCount: 0,
        generatedAt: null,
        updatedAt: null,
        errorMessage: null,
        sourceCounts: { llm: 0, fallback: 0 },
        enemies: [],
      };
    }

    const complete = toPreparedEnemySet(row);
    const enemies = (complete?.enemies ?? row.enemies)
      .slice()
      .sort((left, right) => left.floor - right.floor);
    const sourceCounts = enemies.reduce(
      (counts, enemy) => {
        counts[enemy.generationMeta.source] += 1;
        return counts;
      },
      { llm: 0, fallback: 0 } as Record<
        TowerPreparedEnemy['generationMeta']['source'],
        number
      >,
    );

    return {
      seasonKey,
      realm,
      status:
        row.status === 'ready' && !complete
          ? 'incomplete'
          : (row.status as TowerPreparedEnemySetStatus),
      schemaVersion: row.schemaVersion,
      enemyCount: enemies.length,
      generatedAt: row.generatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      errorMessage: row.errorMessage,
      sourceCounts,
      enemies: enemies.map((enemy) => ({
        floor: enemy.floor,
        kind: enemy.encounter.kind,
        difficulty: enemy.encounter.difficulty,
        race: enemy.encounter.race,
        realmStage: enemy.encounter.realmStage,
        name: enemy.enemy.name,
        title: enemy.enemy.title ?? null,
        source: enemy.generationMeta.source,
        generatedAt: enemy.generationMeta.generatedAt,
      })),
    };
  }

  private async generatePreparedEnemy(args: {
    seasonKey: string;
    realm: RealmType;
    floor: number;
    generatedAt: Date;
  }): Promise<TowerPreparedEnemy> {
    const encounter = buildTowerEncounter(args);
    const variantSeed = buildTowerEnemyVariantSeed(args);
    const draft = await this.generator.enrichNarrative(
      this.generator.buildDraft({
        realm: encounter.realm,
        realmStage: encounter.realmStage,
        race: encounter.race,
        difficulty: encounter.difficulty,
        isBoss: encounter.isBoss,
        variantSeed,
      }),
    );

    return {
      floor: args.floor,
      encounter,
      enemy: draft.cultivator,
      generationMeta: {
        variantSeed,
        source: isLlmEnriched(draft) ? 'llm' : 'fallback',
        generatedAt: args.generatedAt.toISOString(),
      },
    };
  }

  private generateFallbackPreparedEnemy(args: {
    seasonKey: string;
    realm: RealmType;
    floor: number;
  }): TowerPreparedEnemy {
    const encounter = buildTowerEncounter(args);
    const variantSeed = buildTowerEnemyVariantSeed(args);
    const draft = this.fallbackGenerator.buildDraft({
      realm: encounter.realm,
      realmStage: encounter.realmStage,
      race: encounter.race,
      difficulty: encounter.difficulty,
      isBoss: encounter.isBoss,
      variantSeed,
    });

    return {
      floor: args.floor,
      encounter,
      enemy: draft.cultivator,
      generationMeta: {
        variantSeed,
        source: 'fallback',
        generatedAt: new Date(0).toISOString(),
      },
    };
  }
}

export const towerEnemySetService = new TowerEnemySetService();
