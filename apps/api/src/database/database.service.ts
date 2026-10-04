import { Inject, Injectable } from '@nestjs/common';
import { closeDatabase, type DbClient } from '@server/lib/drizzle/db.js';
import { sql } from 'drizzle-orm';

export const DRIZZLE_DATABASE = Symbol('DRIZZLE_DATABASE');

@Injectable()
export class DatabaseService {
  constructor(@Inject(DRIZZLE_DATABASE) readonly client: DbClient) {}

  async healthStatus(): Promise<'up' | 'down'> {
    try {
      await this.client.execute(sql`SELECT 1`);
      return 'up';
    } catch {
      return 'down';
    }
  }

  // RuntimeService invokes this after HTTP and messaging have drained.
  close(): Promise<void> {
    return closeDatabase();
  }
}
