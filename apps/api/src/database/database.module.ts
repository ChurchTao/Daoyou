import { Module } from '@nestjs/common';
import { db } from '@server/lib/drizzle/db.js';
import { DatabaseService, DRIZZLE_DATABASE } from './database.service.js';

// Repositories and Nest providers share the existing transaction-aware client.
@Module({
  providers: [{ provide: DRIZZLE_DATABASE, useValue: db }, DatabaseService],
  exports: [DRIZZLE_DATABASE, DatabaseService],
})
export class DatabaseModule {}
