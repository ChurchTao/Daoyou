import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module.js';
import { TransferAdminController } from './transfer-admin.controller.js';
import { TransferController } from './transfer.controller.js';
import { TransferCrypto } from './transfer-crypto.js';
import { TransferService } from './transfer.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [TransferController, TransferAdminController],
  providers: [TransferCrypto, TransferService],
})
export class TransferModule {}
