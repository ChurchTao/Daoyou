import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators, spiritualRoots } from '@server/lib/drizzle/schema.js';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class EnemiesService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async read(userId: string, id: string) {
    if (!id) throw new HttpException({ error: '请提供有效的敌人ID' }, 400);
    const q = this.database;
    const [enemy] = await q
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        background: cultivators.background,
        vitality: cultivators.vitality,
        strength: cultivators.strength,
        spirit: cultivators.spirit,
        endurance: cultivators.endurance,
        speed: cultivators.speed,
        willpower: cultivators.willpower,
      })
      .from(cultivators)
      .where(
        and(
          eq(cultivators.id, id),
          eq(cultivators.userId, userId),
          eq(cultivators.status, 'active'),
        ),
      )
      .limit(1);
    if (!enemy) {
      throw new HttpException({ error: '敌人角色不存在' }, 404);
    }
    const roots = await q
      .select({
        element: spiritualRoots.element,
        strength: spiritualRoots.strength,
        marrowWashBonus: spiritualRoots.marrowWashBonus,
        grade: spiritualRoots.grade,
      })
      .from(spiritualRoots)
      .where(eq(spiritualRoots.cultivatorId, id));
    return {
      success: true,
      data: {
        id: enemy.id,
        name: enemy.name,
        realm: enemy.realm,
        realm_stage: enemy.realmStage,
        spiritual_roots: roots.map((root) => ({
          ...root,
          baseStrength: root.strength,
          strength: root.strength + (root.marrowWashBonus ?? 0),
        })),
        background: enemy.background,
        combatRating: Math.round(
          (enemy.vitality +
            enemy.strength +
            enemy.spirit +
            enemy.endurance +
            enemy.speed +
            enemy.willpower) /
            6,
        ),
      },
    };
  }
}
