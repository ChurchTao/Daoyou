import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountController } from './account.controller.js';

@Module({ imports: [AuthModule], controllers: [AccountController] })
export class AccountModule {}
